function npmCommandSpec(args, { platform = process.platform, comspec = process.env.ComSpec } = {}) {
  if (platform === 'win32') {
    return {
      executable: comspec || 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd', ...args],
    };
  }
  return { executable: 'npm', args: [...args] };
}

module.exports = { npmCommandSpec };
