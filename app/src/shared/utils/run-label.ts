/**
 * 「这一次出的是哪个包、哪个分组」的那行标签。
 *
 * 队列里同时排着多个包时，界面上只写「第 2/4 项 · 重新签名」是说不出在跑哪个的 ——
 * 人得回头去数队列里第 2 行是谁。标签把包名与分组名直接写进进度标题，
 * 单次出包也一样用，省得两处各写一套拼接。
 *
 * 主进程与渲染层共用：窗口刷新后主进程要能把「在跑哪一个」重新告诉界面，
 * 而它手上只有 TaskInput（分组名得回 groups.json 查），拼接规则必须是同一份。
 */

/** 从路径取文件名。渲染层拿不到 node 的 path，这里连分隔符一起处理 */
export function fileNameOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.slice(normalized.lastIndexOf('/') + 1)
}

/**
 * 拼出标签。两段都可能缺：
 *
 * - 包名缺失（还没选包、或路径是空的）时写「未选 APK」，而不是留一段空白 ——
 *   空白会让人以为标签没生效。
 * - 分组名缺失有两种情况：走「自定义渠道导出」时本来就没有分组（写「自定义渠道」），
 *   以及分组已被删掉（这时查不到名字，也归到自定义，比显示一个 id 有用）。
 */
export function formatRunLabel(apkName: string, groupName: string): string {
  const apk = apkName.trim() === '' ? '未选 APK' : apkName.trim()
  const group = groupName.trim() === '' ? '自定义渠道' : groupName.trim()
  return `${apk} · ${group}`
}