// Stand-in for src/lib/auth.ts in the NTA end-to-end tests: the signed-in student is named by the
// x-test-user header the test sets on each request. Everything after sign-in is the real code.
export async function auth(request) {
  const id = request?.headers?.get('x-test-user');
  return id ? { user: { id, email: `${id}@example.test`, name: 'Test Student' } } : null;
}
export const authWithStatus = async (request) => ({ session: await auth(request), transient: false });
