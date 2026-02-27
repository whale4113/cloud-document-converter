export interface LiveCopyConfig {
  userDataDir: string
  headless: boolean
  targetUrl: string
  expectedText: string
}

type EnvMap = Record<string, string | undefined>

const isEnabled = (value: string | undefined): boolean => value === '1'

export const DEFAULT_LIVE_USER_DATA_DIR =
  'apps/chrome-extension-e2e/.cache/user-data-live'

export const resolveLiveCopyConfig = (
  env: EnvMap = process.env,
): LiveCopyConfig => {
  return {
    userDataDir: env['CDC_E2E_USER_DATA_DIR'] ?? DEFAULT_LIVE_USER_DATA_DIR,
    headless: isEnabled(env['CDC_E2E_HEADLESS'] ?? '1'),
    targetUrl: env['CDC_E2E_TARGET_URL'] ?? '',
    expectedText: env['CDC_E2E_EXPECTED_TEXT'] ?? '',
  }
}
