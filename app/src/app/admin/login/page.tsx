import LoginForm from "./LoginForm";

// force-dynamic: la ruta debe servirse por la función serverless (no como
// asset estático del CDN), para que el POST del server action de login
// no reciba un 405 en Vercel.
export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-forest-950">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, #0b5752 0%, #0b3c36 45%, #0a2d27 100%)",
        }}
      />
      <LoginForm />
    </main>
  );
}
