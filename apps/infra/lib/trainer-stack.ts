import * as path from "node:path";
import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { HttpApi, HttpStage, VpcLink } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpServiceDiscoveryIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { CfnBudget } from "aws-cdk-lib/aws-budgets";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import { Port, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import {
  Cluster,
  ContainerImage,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  LogDrivers,
  OperatingSystemFamily,
  Secret as EcsSecret,
} from "aws-cdk-lib/aws-ecs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { DnsRecordType, NamespaceType } from "aws-cdk-lib/aws-servicediscovery";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";

export interface TrainerStackProps extends StackProps {
  userPoolId: string;
  userPoolClientId: string;
  /** Orígenes que pueden llamar a la API desde el navegador. */
  corsOrigins: string[];
  /** Nombre del parámetro SecureString de SSM con la URI de MongoDB. */
  mongoUriParam: string;
  alertEmail: string;
  /** Importe mensual (USD) a partir del cual avisa AWS Budgets. */
  monthlyBudgetUsd: number;
}

export class TrainerStack extends Stack {
  constructor(scope: Construct, id: string, props: TrainerStackProps) {
    super(scope, id, props);

    // --- API en un servidor siempre encendido (ECS Fargate) --------------------------------------
    // Toda la API normal (CRUD) en un contenedor: sin arranque en frío ni el tope de ejecuciones
    // simultáneas de Lambda. El agente de IA irá en una Lambda aparte (pendiente, ver CLAUDE.md).
    const image = new DockerImageAsset(this, "ApiImage", {
      directory: path.join(__dirname, "../../.."),
      file: "apps/api/Dockerfile",
      platform: Platform.LINUX_AMD64,
    });

    // Solo subredes públicas y sin NAT (un NAT costaría ~33 $/mes): la tarea sale a internet
    // (Mongo Atlas, Cognito, ECR) con IP pública, pero solo acepta tráfico del API Gateway.
    const vpc = new Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: "public", subnetType: SubnetType.PUBLIC, cidrMask: 24 }],
    });

    // Cloud Map: ECS registra ahí la IP de la tarea y el API Gateway la encuentra (sin balanceador).
    const cluster = new Cluster(this, "Cluster", {
      vpc,
      defaultCloudMapNamespace: { name: "trainer.local", type: NamespaceType.DNS_PRIVATE },
    });

    const taskDefinition = new FargateTaskDefinition(this, "ApiTask", {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.X86_64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
    });
    const mongoUri = StringParameter.fromSecureStringParameterAttributes(this, "MongoUri", {
      parameterName: props.mongoUriParam,
    });
    taskDefinition.addContainer("api", {
      image: ContainerImage.fromDockerImageAsset(image),
      portMappings: [{ containerPort: 3001 }],
      logging: LogDrivers.awsLogs({
        streamPrefix: "api",
        logGroup: new LogGroup(this, "ServerLogs", { retention: RetentionDays.ONE_MONTH }),
      }),
      environment: {
        COGNITO_USER_POOL_ID: props.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClientId,
        CORS_ORIGINS: props.corsOrigins.join(","),
      },
      // La contraseña de Mongo llega como variable desde SSM, no escrita en la plantilla.
      secrets: { MONGODB_URI: EcsSecret.fromSsmParameter(mongoUri) },
      // La imagen no trae curl: la comprobación de salud usa el propio Node.
      healthCheck: {
        command: [
          "CMD-SHELL",
          "node -e \"fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"",
        ],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(60),
      },
    });

    const service = new FargateService(this, "ApiService", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      // Si una versión nueva no arranca, vuelve a la anterior sola.
      circuitBreaker: { rollback: true },
      cloudMapOptions: {
        name: "api",
        dnsRecordType: DnsRecordType.SRV,
        containerPort: 3001,
        dnsTtl: Duration.seconds(10),
      },
    });

    // El API Gateway llega a la tarea por un VPC Link; solo él puede entrar al puerto 3001.
    const linkSecurityGroup = new SecurityGroup(this, "VpcLinkSg", { vpc });
    service.connections.allowFrom(linkSecurityGroup, Port.tcp(3001));
    const vpcLink = new VpcLink(this, "VpcLink", {
      vpc,
      subnets: { subnetType: SubnetType.PUBLIC },
      securityGroups: [linkSecurityGroup],
    });

    // API Gateway (HTTPS) hacia el servidor: es la URL pública que usa la app.
    const serverApi = new HttpApi(this, "ServerHttpApi", {
      apiName: "trainer-api-server",
      createDefaultStage: false,
      defaultIntegration: new HttpServiceDiscoveryIntegration(
        "ServerIntegration",
        service.cloudMapService!,
        { vpcLink },
      ),
    });
    new HttpStage(this, "ServerStage", {
      httpApi: serverApi,
      stageName: "$default",
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
    });


    // Alerta de facturación desde el primer día (ver CLAUDE.md).
    new CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: "trainer-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 80,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail }],
        },
        {
          notification: {
            notificationType: "FORECASTED",
            comparisonOperator: "GREATER_THAN",
            threshold: 100,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail }],
        },
      ],
    });

    new CfnOutput(this, "ServerApiUrl", { value: serverApi.apiEndpoint });
  }
}
