import { App } from "aws-cdk-lib";
import { TrainerStack } from "../lib/trainer-stack";

const app = new App();

new TrainerStack(app, "TrainerStack", {
  // Región UE para todo lo que guarde datos (ver CLAUDE.md).
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" },
  userPoolId: "eu-west-1_9OsHE2dsk",
  userPoolClientId: "29oe7bgkhb9bo5b0i3b91fbl6d",
  corsOrigins: ["https://dgalreina.github.io", "http://localhost:8081"],
  mongoUriParam: "/trainer/mongodb-uri",
  alertEmail: "dgalreina@gmail.com",
  monthlyBudgetUsd: 10,
});
