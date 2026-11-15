import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { AdminOverview, AdminUser, AiPlan } from "@trainer/shared";
import type { Model } from "mongoose";
import { CoachUsageService, estimateCostEur, monthKey } from "../coach/coach-usage.service.js";
import { MONTHLY_TOKEN_CAP } from "../coach/plans.js";
import { ProfileDoc } from "../profile/profile.schema.js";
import { SettingsService } from "../settings/settings.service.js";

const attr = (user: UserType, name: string) => user.Attributes?.find((a) => a.Name === name)?.Value ?? null;
/** Tope de páginas de Cognito (60 usuarios cada una): suficiente mientras haya pocos usuarios. */
const MAX_PAGES = 20;

/** El panel de administración: quién usa la app y cuánta IA gasta. Solo números: nunca conversaciones ni datos de salud. */
@Injectable()
export class AdminService {
  private cognito?: CognitoIdentityProviderClient;

  constructor(
    private readonly usage: CoachUsageService,
    private readonly settings: SettingsService,
    @InjectModel(ProfileDoc.name) private readonly profiles: Model<ProfileDoc>,
  ) {}

  private client() {
    return (this.cognito ??= new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? "eu-west-1" }));
  }

  private async listUsers(command: typeof ListUsersCommand | typeof ListUsersInGroupCommand, input: object): Promise<UserType[]> {
    const users: UserType[] = [];
    let token: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const out = await this.client().send(new (command as typeof ListUsersCommand)({ ...input, Limit: 60, ...(token ? { PaginationToken: token } : {}) } as never));
      users.push(...(out.Users ?? []));
      token = out.PaginationToken;
      if (!token) break;
    }
    return users;
  }

  async overview(): Promise<AdminOverview> {
    const poolId = process.env.COGNITO_USER_POOL_ID;
    const month = monthKey(new Date());
    const [cognitoUsers, admins, usage] = await Promise.all([
      this.listUsers(ListUsersCommand, { UserPoolId: poolId }),
      this.listUsers(ListUsersInGroupCommand, { UserPoolId: poolId, GroupName: "admin" }),
      this.usage.monthByUser(month),
    ]);
    const adminIds = new Set(admins.map((u) => attr(u, "sub")));
    const usageById = new Map(usage.map((u) => [u.userId, u]));

    // Cognito manda; si alguien tiene gasto pero ya no está en Cognito, también sale (como «sin cuenta»).
    const known = new Map<string, UserType | null>(cognitoUsers.map((u) => [attr(u, "sub") ?? "", u]));
    for (const u of usage) if (!known.has(u.userId)) known.set(u.userId, null);
    const ids = [...known.keys()].filter(Boolean);

    const [plans, profiles] = await Promise.all([
      this.settings.aiPlans(ids),
      this.profiles.find({ userId: { $in: ids } }, { userId: 1, name: 1 }).lean(),
    ]);
    const names = new Map(profiles.map((p) => [p.userId, p.name]));

    const users: AdminUser[] = ids.map((userId) => {
      const cognitoUser = known.get(userId) ?? null;
      const isAdmin = adminIds.has(userId);
      const plan: AiPlan = isAdmin ? "pro" : (plans.get(userId) ?? "gratis");
      const u = usageById.get(userId);
      const inputTokens = (u?.inputTokens ?? 0) + (u?.cacheReadTokens ?? 0) + (u?.cacheWriteTokens ?? 0);
      return {
        userId,
        email: cognitoUser ? attr(cognitoUser, "email") : null,
        name: names.get(userId) ?? null,
        isAdmin,
        plan,
        calls: u?.calls ?? 0,
        totalTokens: inputTokens + (u?.outputTokens ?? 0),
        capTokens: MONTHLY_TOKEN_CAP[plan],
        costEur: u ? estimateCostEur(u) : 0,
        lastUsedAt: u?.lastUsedAt.toISOString() ?? null,
        signedUpAt: cognitoUser?.UserCreateDate?.toISOString() ?? null,
      };
    });
    users.sort((a, b) => b.costEur - a.costEur || (b.signedUpAt ?? "").localeCompare(a.signedUpAt ?? ""));

    return {
      month,
      totals: {
        users: users.length,
        calls: users.reduce((s, u) => s + u.calls, 0),
        totalTokens: users.reduce((s, u) => s + u.totalTokens, 0),
        costEur: Math.round(users.reduce((s, u) => s + u.costEur, 0) * 10_000) / 10_000,
      },
      users,
    };
  }

  setPlan(userId: string, plan: AiPlan): Promise<void> {
    return this.settings.setAiPlan(userId, plan);
  }
}
