function pushLog(entry) {
  window.state.logs.push(entry);      // 末尾に追加（下が最新）
  renderLog();
}

function pushGroup(entries) {
  window.state.logs = window.state.logs.concat(entries); // 末尾にまとめて追加
  renderLog();
}
