// 修改后的 confirm 函数，直接跳过提示并始终返回 true
export const confirm = (): Promise<boolean> => {
  return Promise.resolve(true) // 直接 resolve(true)，跳过提示
}
