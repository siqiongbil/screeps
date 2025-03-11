// cleanup.js
// 每 tick 清除 Memory 中不再存在的 creep 数据
module.exports.cleanup = function () {
    for (const name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log(`Memory cleanup: Removed dead creep ${name}`);
        }
    }
};
