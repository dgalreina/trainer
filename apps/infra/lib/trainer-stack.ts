import * as path from "node:path";
import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { HttpApi, HttpStage } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { CfnBudget } from "aws-cdk-lib/aws-budgets";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Architecture, Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
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

    // Una sola Lambda para toda la API normal (CRUD): un único arranque en frío.
    // lambda-dist lo genera `npm run build:lambda --workspace apps/api`.
    const logGroup = new LogGroup(this, "ApiLogs", {
      retention: RetentionDays.ONE_MONTH,
    });

    const apiFn = new Function(this, "ApiFunction", {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: "dist/lambda.handler",
      code: Code.fromAsset(path.join(__dirname, "../../api/lambda-dist")),
      memorySize: 512,
      timeout: Duration.seconds(15),
      logGroup,
      environment: {
        COGNITO_USER_POOL_ID: props.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClientId,
        CORS_ORIGINS: props.corsOrigins.join(","),
        MONGODB_URI_PARAM: props.mongoUriParam,
      },
    });

    // La URI de Mongo (con la contraseña) vive en SSM, no en el entorno de la función.
    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          this.formatArn({
            service: "ssm",
            resource: "parameter",
            resourceName: props.mongoUriParam.replace(/^\//, ""),
          }),
        ],
      }),
    );
    // SecureString con la clave gestionada por AWS (aws/ssm): solo vía SSM.
    apiFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["kms:Decrypt"],
        resources: ["*"],
        conditions: {
          StringEquals: { "kms:ViaService": `ssm.${this.region}.amazonaws.com` },
        },
      }),
    );

    const httpApi = new HttpApi(this, "HttpApi", {
      apiName: "trainer-api",
      createDefaultStage: false,
      defaultIntegration: new HttpLambdaIntegration("ApiIntegration", apiFn),
    });
    // Tope de peticiones: protege el coste si algo (o alguien) abusa de la API.
    new HttpStage(this, "DefaultStage", {
      httpApi,
      stageName: "$default",
      autoDeploy: true,
      throttle: { rateLimit: 20, burstLimit: 40 },
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

    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
  }
}
