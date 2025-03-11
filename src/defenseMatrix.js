// defenseMatrix.js
/*
 * defenseMatrix.js
 * 用于在房间内自动建立防御矩阵——在所有 Spawn 周围建立一圈 Rampart 施工工地。
 * 注意：建议在房间经济稳定后启用，避免频繁占用 CPU 和能量。
 */
module.exports.scheduleDefenseMatrix = function (room) {
    if (!room.controller || !room.controller.my) return; // 仅对我方房间执行
    const spawns = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_SPAWN });
    if (spawns.length === 0) return;

    const radius = 5; // 防御矩阵半径，可根据实际需要调整

    // 检查当前防御矩阵是否已经建造完成并且处于良好状态
    let defenseMatrixComplete = true;
    spawns.forEach(spawn => {
        const centerX = spawn.pos.x;
        const centerY = spawn.pos.y;
        for (let x = centerX - radius; x <= centerX + radius; x++) {
            for (let y = centerY - radius; y <= centerY + radius; y++) {
                if (x === centerX - radius || x === centerX + radius || y === centerY - radius || y === centerY + radius) {
                    const pos = new RoomPosition(x, y, room.name);
                    const structures = pos.lookFor(LOOK_STRUCTURES);
                    if (!structures.some(s => s.structureType === STRUCTURE_RAMPART && s.hits > s.hitsMax * 0.8)) {
                        defenseMatrixComplete = false;
                        break;
                    }
                }
            }
            if (!defenseMatrixComplete) break;
        }
    });

    // 如果当前防御矩阵已经建造完成并且处于良好状态，则放置新的防御矩阵工地
    if (defenseMatrixComplete) {
        spawns.forEach(spawn => {
            const centerX = spawn.pos.x;
            const centerY = spawn.pos.y;
            for (let x = centerX - radius; x <= centerX + radius; x++) {
                for (let y = centerY - radius; y <= centerY + radius; y++) {
                    if (x === centerX - radius || x === centerX + radius || y === centerY - radius || y === centerY + radius) {
                        const pos = new RoomPosition(x, y, room.name);
                        const terrain = room.lookForAt(LOOK_TERRAIN, x, y)[0];
                        const structures = pos.lookFor(LOOK_STRUCTURES);
                        const constructionSites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
                        if (terrain !== 'wall' && structures.length === 0 && constructionSites.length === 0) {
                            const result = room.createConstructionSite(pos, STRUCTURE_RAMPART);
                            if (result === OK) {
                                console.log(`Created rampart construction site at ${pos}`);
                            }
                        }
                    }
                }
            }
        });
    } else {
        // 如果当前防御矩阵未建造完成或处于损坏状态，则继续建造或修复现有的防御矩阵工地
        spawns.forEach(spawn => {
            const centerX = spawn.pos.x;
            const centerY = spawn.pos.y;
            for (let x = centerX - radius; x <= centerX + radius; x++) {
                for (let y = centerY - radius; y <= centerY + radius; y++) {
                    if (x === centerX - radius || x === centerX + radius || y === centerY - radius || y === centerY + radius) {
                        const pos = new RoomPosition(x, y, room.name);
                        const terrain = room.lookForAt(LOOK_TERRAIN, x, y)[0];
                        const structures = pos.lookFor(LOOK_STRUCTURES);
                        const constructionSites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
                        if (terrain !== 'wall' && structures.length === 0 && constructionSites.length === 0) {
                            const result = room.createConstructionSite(pos, STRUCTURE_RAMPART);
                            if (result === OK) {
                                console.log(`Created rampart construction site at ${pos}`);
                            }
                        }
                    }
                }
            }
        });
    }
};