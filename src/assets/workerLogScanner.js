var regex = /https:\/\/([\w|-]+)\.api\.letsencrypt\.org\/acme\/authz([a-zA-Z0-9_\-/]+)/
self.onmessage = function (e) {
  var lines = e.data.split('\n')
  var out = {}
  self.postMessage({ kind: 'count', data: lines.length })
  var line = null,
    result = null
  for (var i = 0; i < lines.length; i++) {
    line = lines[i]
    result = regex.exec(line)
    if (result !== null && result.length === 3) {
      out[result[1] + result[2]] = result[0]
    }
  }
  self.postMessage({ kind: 'processed', data: Object.values(out) })
}
