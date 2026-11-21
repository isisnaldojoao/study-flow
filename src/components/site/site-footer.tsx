import Link from "next/link";
import { AppLogo } from "@/components/brand/app-logo";
import { APP_NAME } from "@/lib/constants";

export function SiteFooter({ variant = "home" }: { variant?: "home" | "site" }) {
  const section = (id: string) => (variant === "home" ? `#${id}` : `/#${id}`);

  return (
    <footer className="border-t border-border/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AppLogo
              size={32}
              className="rounded-xl bg-primary text-primary-foreground ring-0"
            />
            <span className="font-[family-name:var(--font-fraunces)] tracking-tight">
              {APP_NAME}
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Organize o semestre sem planilha. A conta acompanha você.
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"
          aria-label="Rodapé"
        >
          <Link href={section("recursos")} className="hover:text-foreground">
            Recursos
          </Link>
          <Link href={section("painel")} className="hover:text-foreground">
            O painel
          </Link>
          <Link href={section("duvidas")} className="hover:text-foreground">
            Dúvidas
          </Link>
          <Link href="/blog" className="hover:text-foreground">
            Blog
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Entrar
          </Link>
          <Link href="/cadastro" className="hover:text-foreground">
            Criar conta
          </Link>
        </nav>
      </div>
      <div className="border-t border-border/70">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          © 2026 {APP_NAME}. Propriedade da{" "}
          <a
            href="https://redboalt.com/"
            className="font-medium text-foreground underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Redboalt - Navegando na Web
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
