import { nowISO } from "@/lib/dates";
import { toCamel, toSnake } from "@/lib/records";
import { getSupabase } from "@/lib/supabase";
import { notifyDataChange } from "@/lib/data-sync";
import type { RegisterInput } from "@/schemas/auth";
import type { Session, User, UserPreferences } from "@/types";

const defaultPreferences: UserPreferences = {
  theme: "system",
  defaultReminderDays: 1,
  notificationsEnabled: true,
  browserPushEnabled: false,
};

export const EMAIL_NOT_CONFIRMED_MESSAGE = "Confirme o e-mail antes de entrar.";

function authError(message: string) {
  const known: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha inválidos.",
    "User already registered": "Já existe uma conta com este e-mail.",
    "Email not confirmed": EMAIL_NOT_CONFIRMED_MESSAGE,
  };
  return known[message] ?? message;
}

export type RegisterResult =
  | { status: "signed_in"; session: Session }
  | { status: "confirm_email"; email: string };

async function profileFor(userId: string, email: string, nameHint?: string): Promise<User> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!data) {
    const created = {
      id: userId,
      name: nameHint?.trim() || email.split("@")[0] || "Estudante",
      preferences: defaultPreferences,
      createdAt: nowISO(),
    };
    const { error: insertError } = await supabase.from("profiles").insert(toSnake(created));
    if (insertError) throw new Error(insertError.message);
    return {
      ...created,
      email,
      passwordHash: "",
      salt: "",
    };
  }

  const profile = toCamel<{
    id: string;
    name: string;
    preferences?: UserPreferences;
    createdAt?: string;
  }>(data as Record<string, unknown>);

  return {
    id: profile.id,
    name: profile.name,
    email,
    passwordHash: "",
    salt: "",
    createdAt: profile.createdAt ?? nowISO(),
    preferences: profile.preferences ?? defaultPreferences,
  };
}

function toSession(user: User): Session {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    loggedAt: nowISO(),
  };
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });
  if (error) throw new Error(authError(error.message));
  if (!data.user) throw new Error("Não foi possível criar a conta.");
  if (!data.session) {
    return { status: "confirm_email", email };
  }
  const user = await profileFor(data.user.id, email, input.name);
  return { status: "signed_in", session: toSession(user) };
}

export async function loginUser(email: string, password: string): Promise<Session> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: normalized,
    password,
  });
  if (error || !data.user) {
    throw new Error(authError(error?.message ?? "E-mail ou senha inválidos."));
  }
  const user = await profileFor(data.user.id, normalized);
  return toSession(user);
}

export async function resetPassword(email: string) {
  const redirectTo =
    typeof window === "undefined" ? undefined : `${window.location.origin}/login`;
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  if (error) throw new Error(authError(error.message));
}

export async function logoutUser() {
  await getSupabase().auth.signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user?.email) return null;
  return profileFor(data.user.id, data.user.email, data.user.user_metadata?.name);
}

export async function updateUserProfile(
  userId: string,
  data: { name?: string; preferences?: Partial<UserPreferences> }
) {
  const patch: Record<string, unknown> = {};
  if (data.name) patch.name = data.name.trim();
  if (data.preferences) {
    const { data: row, error: readError } = await getSupabase()
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    const server =
      row?.preferences && typeof row.preferences === "object"
        ? (row.preferences as Record<string, unknown>)
        : {};
    patch.preferences = { ...server, ...data.preferences };
  }
  const { error } = await getSupabase().from("profiles").update(toSnake(patch)).eq("id", userId);
  if (error) throw new Error(error.message);
  notifyDataChange();
}

export async function changePassword(
  _userId: string,
  currentPassword: string,
  newPassword: string
) {
  const { data } = await getSupabase().auth.getUser();
  const email = data.user?.email;
  if (!email) throw new Error("Usuário não encontrado.");

  const { error: signError } = await getSupabase().auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signError) throw new Error("Senha atual incorreta.");

  const { error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) throw new Error(authError(error.message));
}
