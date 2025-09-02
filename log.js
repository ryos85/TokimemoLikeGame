function pushLog(entry) {
  window.state.logs.unshift(entry);
  renderLog();
}

function pushGroup(entries) {
  window.state.logs = entries.concat(window.state.logs);
  renderLog();
}
