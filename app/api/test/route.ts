export async function GET() {
  return new Response(JSON.stringify({ message: 'API works!' }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
