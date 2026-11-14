import { handle } from './router.ts'

export default {
	fetch(request, env) {
		const url = new URL(request.url)
		if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return handle(request, env)
		return new Response(null, { status: 404 })
	},
} satisfies ExportedHandler<Env>
