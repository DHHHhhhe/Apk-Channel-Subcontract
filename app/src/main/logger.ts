import fs from 'node:fs'
import path from 'node:path'
import { getLogsDir } from './paths'

export interface TaskLogger {
  file: string
  section(title: string): void
  info(message: string): void
  child(tag: string, line: string): void
  error(message: string): void
}

function stamp(): string {
  return new Date().toISOString().slice(11, 23)
}

/**
 * 日志最多留几份。
 *
 * 5 份是「够回看」和「不占地方」之间的那个点：出包一次就是几万字，一个包的全流程
 * 输出几十上百 KB，攒到几十份时 logs/ 已经能到几十 MB，而真正会回头翻的通常只有
 * 最近那几次 —— 更早的那些出了问题也早就没有上下文了。要查更早的，靠版本库里的
 * 记录和当时的诊断信息。
 */
export const MAX_LOG_FILES = 5

/**
 * 清理旧日志：按修改时间从最旧的开始删，只留下最新的 MAX_LOG_FILES 份。
 *
 * 只按份数清，不设体积上限 —— 份数封死之后总量天然有界（5 份 × 单个几万字），
 * 再加一条体积线只会让两种规则互相打架：某几份恰好都很大时，是按份数留 5 份，
 * 还是按体积再往下删？多一条规则不换来任何保护。清理失败一律吞掉 ——
 * 这是收尾动作，不能因为它把出包本身搞失败。
 */
export function pruneTaskLogs(dir: string = getLogsDir()): number {
  let entries: { file: string; size: number; mtimeMs: number }[]
  try {
    entries = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.log'))
      .map((name) => {
        const file = path.join(dir, name)
        const stat = fs.statSync(file)
        return { file, size: stat.size, mtimeMs: stat.mtimeMs }
      })
  } catch {
    // 目录还不存在、或者读不了：当作没有旧日志
    return 0
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs) // 新 → 旧
  let removed = 0

  for (let index = entries.length - 1; index >= MAX_LOG_FILES; index -= 1) {
    try {
      fs.rmSync(entries[index].file, { force: true })
      removed += 1
    } catch {
      // 删不掉就留着，继续看下一份
    }
  }

  return removed
}

/**
 * 每次出包一份日志，UTF-8 落盘。
 *
 * 任务结束后**不删除** —— 验收要求「处理失败后日志文件仍在，可看到 walle 或
 * apksigner 的原始输出」。删掉就等于失败时无从查起，所以只按份数轮转。
 *
 * **先建再清。** 早先是先清旧的再建新的：那样清的时候手上只有旧文件，按「留 5 份」
 * 清完，加进本轮这份就变成 6 份 —— 上限永远多一份，且多出来的那份每次都在变。
 * 现在本轮这份先落盘，它是最新的一份，之后的清理把它一起算进 5 份里。
 */
export function createTaskLogger(taskId: string): TaskLogger {
  const file = path.join(getLogsDir(), `${taskId}.log`)
  fs.writeFileSync(file, '', 'utf8')
  pruneTaskLogs()
  const append = (text: string): void => {
    fs.appendFileSync(file, `${text}\n`, 'utf8')
  }
  return {
    file,
    section(title) {
      append(`\n===== ${stamp()} ${title} =====`)
    },
    info(message) {
      append(`[${stamp()}] ${message}`)
    },
    child(tag, line) {
      append(`[${stamp()}] <${tag}> ${line}`)
    },
    error(message) {
      append(`[${stamp()}] !! ${message}`)
    },
  }
}
