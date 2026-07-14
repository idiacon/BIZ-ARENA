(function startBizArenaApplication(global) {
  const modules = global.BizArenaFrontendModules || {};
  const required = ['serverAdmin', 'student', 'teacher'];
  const missing = required.filter(key => !modules[key]);
  if (missing.length) throw new Error(`Missing frontend modules: ${missing.join(', ')}`);
  bootstrap();
})(window);
