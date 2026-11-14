declare namespace Cloudflare {
	interface Env {
		// Test-only override of the PBKDF2 iteration count (see worker/auth.ts).
		PBKDF2_ITERATIONS?: string
	}
}
