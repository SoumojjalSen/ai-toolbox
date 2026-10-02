// One timestamped line to stdout — `docker logs -f ai-toolbox` shows it live
export function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`)
}
