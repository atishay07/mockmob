// The Sunday Mock's kill switch (src/lib/sundayMock.mjs). SUNDAY_MOCK_ENABLED=false turns off every /api/sunday route, and with
// them the Today card, Practice's chip, the den block and the in-app page (each draws nothing, or says it is switched off), and
// the public page /sunday-mock (404). Anything else, unset included, leaves it on: it needs no migration. Server only (env).
export const sundayMockEnabled = () => process.env.SUNDAY_MOCK_ENABLED !== 'false';
