// formation.js
// 阵型管理模块：根据房间状态和控制器等级规划阵型
module.exports.planFormation = function (room) {
    // 根据控制器等级和房间状态规划阵型
    if (room.controller.level >= 3) {
        // 控制器等级 3 及以上时，规划基本阵型
        // 例如：将 Harvester 和 Upgrader 分布在不同的位置
        const harvesters = room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === 'harvester' });
        const upgraders = room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === 'upgrader' });

        // 将 Harvester 分布在不同的 Source 附近
        const sources = room.find(FIND_SOURCES_ACTIVE);
        harvesters.forEach((harvester, index) => {
            const source = sources[index % sources.length];
            if (source) {
                harvester.memory.sourceId = source.id;
            }
        });

        // 将 Upgrader 分布在控制器附近
        upgraders.forEach(upgrader => {
            upgrader.memory.targetId = room.controller.id;
        });
    }

    if (room.controller.level >= 6) {
        // 控制器等级 6 及以上时，规划更复杂的阵型
        // 例如：增加 Builder 和 Repairer 的数量
        const builders = room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === 'builder' });
        const repairers = room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === 'repairer' });

        // 增加 Builder 和 Repairer 的数量
        if (builders.length < 4) {
            const newName = `Builder_${Game.time}`;
            if (spawn.spawnCreep(roles.builder.body, newName, { memory: { role: 'builder' } }) === OK) {
                console.log(`Spawning new builder: ${newName}`);
            }
        }
        if (repairers.length < 2) {
            const newName = `Repairer_${Game.time}`;
            if (spawn.spawnCreep(roles.repairer.body, newName, { memory: { role: 'repairer' } }) === OK) {
                console.log(`Spawning new repairer: ${newName}`);
            }
        }
    }

    // 根据需要还可以扩展其它阵型规划逻辑……
};