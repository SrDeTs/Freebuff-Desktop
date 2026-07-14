export const FREEBUFF_MODELS = [
  { id: 'minimax/minimax-m3', label: 'MiniMax M3', tier: 'full' as const },
  { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'full' as const },
  { id: 'mimo/mimo-2.5-pro', label: 'MiMo 2.5 Pro', tier: 'full' as const },
  { id: 'kimi/kimi-k2.7-code', label: 'Kimi K2.7 Code', tier: 'full' as const },
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'limited' as const },
  { id: 'mimo/mimo-2.5', label: 'MiMo 2.5', tier: 'limited' as const },
]

export function modelLabel(id: string) {
  return FREEBUFF_MODELS.find((m) => m.id === id)?.label || id
}
