const handler = () =>
  new Response(
    JSON.stringify({
      error: 'Disabled',
      message: 'Backend API is disabled. This app uses Supabase only.',
    }),
    {
      status: 410,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    }
  );

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH, handler as OPTIONS };
