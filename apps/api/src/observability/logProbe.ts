const buffer: any[] = [];

export function addLog(entry: any) {
  buffer.push(entry);
}

export function getLogs() {
  return buffer.slice();
}

export function clearLogs() {
  buffer.length = 0;
}

export default { addLog, getLogs, clearLogs };

