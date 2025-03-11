// spawner.js
const chooseInvasionTarget = require('./invasion').chooseInvasionTarget;
const canInvasionSucceed = require('./invasion').canInvasionSucceed;

// 定义各角色的配置：包含生成所需的身体部件和目标数量
const roles = {
    harvester: { body: [WORK, CARRY, MOVE], count: 2 },
    strongHarvester: { body: [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE], count: 1 }, // 强化版采集者
    upgrader: { body: [WORK, CARRY, MOVE], count: 2 },
    builder: { body: [WORK, CARRY, MOVE], count: 2 },
    repairer: { body: [WORK, CARRY, MOVE], count: 1 },
    soldier: { body: [TOUGH, MOVE, MOVE, ATTACK, ATTACK], count: 2 },
    claimer: { body: [CLAIM, MOVE], count: 1 },
    ranger: { body: [TOUGH, MOVE, RANGED_ATTACK, RANGED_ATTACK], count: 2 },
    healer: { body: [MOVE, HEAL, HEAL], count: 1 },
    defender: { body: [TOUGH, MOVE, ATTACK, ATTACK], count: 2 },
    mineralHarvester: { body: [WORK, WORK, CARRY, MOVE], count: 1 },
    linkManager: { body: [CARRY, MOVE], count: 1 }, // 新增 LinkManager 角色
    transporter: { body: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], count: 1 } // 新增资源运送者角色
};

module.exports.spawnCreeps = function (room) {
    // 仅对拥有 Spawn 的房间操作
    const spawns = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_SPAWN });
    if (spawns.length === 0) return;
    const spawn = spawns[0];

    // 统计当前房间各角色数量（只统计在本房间的 creep）
    const counts = {
        harvester: _.filter(Game.creeps, c => c.memory.role === 'harvester' && c.room.name === room.name).length,
        strongHarvester: _.filter(Game.creeps, c => c.memory.role === 'strongHarvester' && c.room.name === room.name).length, // 强化版采集者
        upgrader: _.filter(Game.creeps, c => c.memory.role === 'upgrader' && c.room.name === room.name).length,
        builder: _.filter(Game.creeps, c => c.memory.role === 'builder' && c.room.name === room.name).length,
        repairer: _.filter(Game.creeps, c => c.memory.role === 'repairer' && c.room.name === room.name).length,
        soldier: _.filter(Game.creeps, c => c.memory.role === 'soldier' && c.room.name === room.name).length,
        claimer: _.filter(Game.creeps, c => c.memory.role === 'claimer' && c.room.name === room.name).length,
        ranger: _.filter(Game.creeps, c => c.memory.role === 'ranger' && c.room.name === room.name).length,
        healer: _.filter(Game.creeps, c => c.memory.role === 'healer' && c.room.name === room.name).length,
        defender: _.filter(Game.creeps, c => c.memory.role === 'defender' && c.room.name === room.name).length,
        mineralHarvester: _.filter(Game.creeps, c => c.memory.role === 'mineralHarvester' && c.room.name === room.name).length,
        linkManager: _.filter(Game.creeps, c => c.memory.role === 'linkManager' && c.room.name === room.name).length, // 新增 LinkManager 角色
        transporter: _.filter(Game.creeps, c => c.memory.role === 'transporter' && c.room.name === room.name).length // 新增资源运送者角色
    };

    // 检查 Storage 状态
    const storage = room.storage;
    const storageEnergy = storage ? storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0;

    // 检查房间能量状态
    const roomEnergyAvailable = room.energyAvailable;
    const roomEnergyCapacityAvailable = room.energyCapacityAvailable;

    // 获取房间控制器等级
    const controllerLevel = room.controller.level;

    // 根据控制器等级动态调整 creep 的生产数量
    switch (controllerLevel) {
        case 1:
            roles.harvester.count = 3;
            roles.upgrader.count = 2;
            roles.builder.count = 1;
            roles.strongHarvester.count = 1; // 新增 strongHarvester 的数量
            break;
        case 2:
            roles.harvester.count = 4;
            roles.upgrader.count = 2;
            roles.builder.count = 2;
            roles.soldier.count = 2;
            roles.claimer.count = 1;
            roles.strongHarvester.count = 2; // 新增 strongHarvester 的数量
            break;
        case 3:
            roles.harvester.count = 3;
            roles.upgrader.count = 3;
            roles.builder.count = 3;
            roles.repairer.count = 1;
            roles.soldier.count = 3;
            roles.claimer.count = 1;
            roles.ranger.count = 2;
            roles.healer.count = 1;
            roles.strongHarvester.count = 4; // 新增 strongHarvester 的数量
            break;
        case 4:
            roles.harvester.count = 2;
            roles.upgrader.count = 4;
            roles.builder.count = 4;
            roles.repairer.count = 2;
            roles.soldier.count = 4;
            roles.claimer.count = 1;
            roles.ranger.count = 3;
            roles.healer.count = 2;
            roles.mineralHarvester.count = 1;
            roles.strongHarvester.count = 4; // 新增 strongHarvester 的数量
            break;
        case 5:
            roles.harvester.count = 2;
            roles.upgrader.count = 5;
            roles.builder.count = 5;
            roles.repairer.count = 3;
            roles.soldier.count = 5;
            roles.claimer.count = 1;
            roles.ranger.count = 4;
            roles.healer.count = 3;
            roles.mineralHarvester.count = 2;
            roles.linkManager.count = 1;
            roles.strongHarvester.count = 5; // 新增 strongHarvester 的数量
            break;
        case 6:
            roles.harvester.count = 2;
            roles.upgrader.count = 6;
            roles.builder.count = 6;
            roles.repairer.count = 4;
            roles.soldier.count = 6;
            roles.claimer.count = 1;
            roles.ranger.count = 5;
            roles.healer.count = 4;
            roles.mineralHarvester.count = 3;
            roles.linkManager.count = 2;
            roles.strongHarvester.count = 6; // 新增 strongHarvester 的数量
            break;
        case 7:
            roles.harvester.count = 2;
            roles.upgrader.count = 7;
            roles.builder.count = 7;
            roles.repairer.count = 5;
            roles.soldier.count = 7;
            roles.claimer.count = 1;
            roles.ranger.count = 6;
            roles.healer.count = 5;
            roles.mineralHarvester.count = 4;
            roles.linkManager.count = 3;
            roles.strongHarvester.count = 7; // 新增 strongHarvester 的数量
            break;
        case 8:
            roles.harvester.count = 2;
            roles.upgrader.count = 8;
            roles.builder.count = 8;
            roles.repairer.count = 6;
            roles.soldier.count = 8;
            roles.claimer.count = 1;
            roles.ranger.count = 7;
            roles.healer.count = 6;
            roles.mineralHarvester.count = 5;
            roles.linkManager.count = 4;
            roles.strongHarvester.count = 8; // 新增 strongHarvester 的数量
            break;
        default:
            roles.harvester.count = 2;
            roles.upgrader.count = 9;
            roles.builder.count = 9;
            roles.repairer.count = 7;
            roles.soldier.count = 9;
            roles.claimer.count = 1;
            roles.ranger.count = 8;
            roles.healer.count = 7;
            roles.mineralHarvester.count = 6;
            roles.linkManager.count = 5;
            roles.strongHarvester.count = 9; // 新增 strongHarvester 的数量
            break;
    }

    // 检查 CPU 使用情况
    if (Game.cpu.getUsed() > Game.cpu.tickLimit * 0.9) {
        console.log(`CPU usage is high: ${Game.cpu.getUsed()}/${Game.cpu.tickLimit}`);
        return;
    }

    // 经济基础：保证足够的采集者和升级者
    if (counts.harvester < roles.harvester.count) {
        const newName = `Harvester_${Game.time}`;
        if (spawn.spawnCreep(roles.harvester.body, newName, { memory: { role: 'harvester', homeRoom: spawn.room.name } }) === OK) {
            console.log(`Spawning new harvester: ${newName}`);
            return;
        }
    }
    if (counts.upgrader < roles.upgrader.count) {
        const newName = `Upgrader_${Game.time}`;
        if (spawn.spawnCreep(roles.upgrader.body, newName, { memory: { role: 'upgrader', homeRoom: spawn.room.name } }) === OK) {
            console.log(`Spawning new upgrader: ${newName}`);
            return;
        }
    }

    // 检测周围是否有无主房间
    const targetRoomName = chooseInvasionTarget(room);
    if (targetRoomName) {
        const targetRoom = Game.rooms[targetRoomName];
        if (targetRoom && targetRoom.controller && !targetRoom.controller.owner) {
            // 控制器到达2级且资源大于200时，生产宣称者
            if (room.controller.level >= 2 && room.energyAvailable >= 200) {
                const newName = `Claimer_${Game.time}`;
                const body = [CLAIM, MOVE];
                if (room.spawnCreep(body, newName, { memory: { role: 'claimer', invasionTarget: targetRoomName } }) === OK) {
                    console.log(`Spawning new claimer: ${newName} for room ${targetRoomName}`);
                }
            }
        }
    }

    // 当能量大于等于 500 且普通采集者数量足够时，生成加强版采集者
    if (counts.harvester >= roles.harvester.count && roomEnergyAvailable >= 500 && counts.strongHarvester < roles.strongHarvester.count) {
        const newName = `StrongHarvester_${Game.time}`;
        if (spawn.spawnCreep(roles.strongHarvester.body, newName, { memory: { role: 'strongHarvester', homeRoom: spawn.room.name } }) === OK) {
            console.log(`Spawning new strong harvester: ${newName}`);
            return;
        }
    }

    // 如果 Storage 未填满或未建造，优先孵化 Harvester
    if (!storage || storageEnergy < storage.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
        if (counts.harvester < roles.harvester.count * 2) { // 增加 Harvester 的数量
            const newName = `Harvester_${Game.time}`;
            if (spawn.spawnCreep(roles.harvester.body, newName, { memory: { role: 'harvester', homeRoom: spawn.room.name } }) === OK) {
                console.log(`Spawning new harvester: ${newName}`);
                return;
            }
        }
    }

    // 优先孵化建造者，确保能够建造 Storage 和 Extension，但仅在采集者数量足够时
    if (counts.harvester >= roles.harvester.count && roomEnergyAvailable >= 200 && counts.builder < roles.builder.count) {
        const newName = `Builder_${Game.time}`;
        if (spawn.spawnCreep(roles.builder.body, newName, { memory: { role: 'builder', homeRoom: spawn.room.name } }) === OK) {
            console.log(`Spawning new builder: ${newName}`);
            return;
        }
    }

    // 当能量充足时增加 Builder 和 Repairer
    if (roomEnergyCapacityAvailable >= 500) {
        if (counts.builder < roles.builder.count) {
            const newName = `Builder_${Game.time}`;
            if (spawn.spawnCreep(roles.builder.body, newName, { memory: { role: 'builder', homeRoom: spawn.room.name } }) === OK) {
                console.log(`Spawning new builder: ${newName}`);
                return;
            }
        }
        if (counts.repairer < roles.repairer.count) {
            const newName = `Repairer_${Game.time}`;
            if (spawn.spawnCreep(roles.repairer.body, newName, { memory: { role: 'repairer', homeRoom: spawn.room.name } }) === OK) {
                console.log(`Spawning new repairer: ${newName}`);
                return;
            }
        }
    }

    // 矿物采集：当房间内有矿物且存在 Extractor 时，孵化矿物采集者
    if (room.find(FIND_MINERALS).length > 0) {
        const extractors = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR });
        if (extractors.length > 0) {
            if (counts.mineralHarvester < roles.mineralHarvester.count) {
                const newName = `MineralHarvester_${Game.time}`;
                if (spawn.spawnCreep(roles.mineralHarvester.body, newName, { memory: { role: 'mineralHarvester', homeRoom: spawn.room.name } }) === OK) {
                    console.log(`Spawning new mineral harvester: ${newName}`);
                    return;
                }
            }
        }
    }

    // Link 管理：当房间内有 Link 时，孵化 LinkManager
    if (room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK }).length >= 2) {
        if (counts.linkManager < roles.linkManager.count) {
            const newName = `LinkManager_${Game.time}`;
            if (spawn.spawnCreep(roles.linkManager.body, newName, { memory: { role: 'linkManager', homeRoom: spawn.room.name } }) === OK) {
                console.log(`Spawning new link manager: ${newName}`);
                return;
            }
        }
    }

    // 入侵扩张：当房间经济稳定且控制器等级 ≥ 2 时启动入侵任务
    if (roomEnergyAvailable > 500 && room.controller.level >= 2) {
        // 如果还没有设置入侵目标，则选择一个相邻房间作为目标
        if (!room.memory.invasionTarget) {
            const invasionTarget = chooseInvasionTarget(room);
            if (invasionTarget) {
                room.memory.invasionTarget = invasionTarget;
                console.log(`Room ${room.name} launching invasion: target ${invasionTarget}`);
            }
        }
        // 若已有入侵目标，则生成入侵队伍：Soldier、Ranger、Healer、Claimer
        if (room.memory.invasionTarget) {
            // 判断入侵队伍是否能够成功
            if (!canInvasionSucceed(room, room.memory.invasionTarget)) {
                // 如果不能成功，则选择下一个房间再判断
                room.memory.invasionTarget = null;
                return;
            }

            if (counts.soldier < roles.soldier.count) {
                const newName = `Soldier_${Game.time}`;
                if (spawn.spawnCreep(roles.soldier.body, newName, { memory: { role: 'soldier', invasionTarget: room.memory.invasionTarget, homeRoom: spawn.room.name } }) === OK) {
                    console.log(`Spawning new soldier: ${newName}`);
                    return;
                }
            }
            if (counts.ranger < roles.ranger.count) {
                const newName = `Ranger_${Game.time}`;
                if (spawn.spawnCreep(roles.ranger.body, newName, { memory: { role: 'ranger', invasionTarget: room.memory.invasionTarget, homeRoom: spawn.room.name } }) === OK) {
                    console.log(`Spawning new ranger: ${newName}`);
                    return;
                }
            }
            if (counts.healer < roles.healer.count) {
                const newName = `Healer_${Game.time}`;
                if (spawn.spawnCreep(roles.healer.body, newName, { memory: { role: 'healer', invasionTarget: room.memory.invasionTarget, homeRoom: spawn.room.name } }) === OK) {
                    console.log(`Spawning new healer: ${newName}`);
                    return;
                }
            }
            if (counts.claimer < roles.claimer.count) {
                const newName = `Claimer_${Game.time}`;
                if (spawn.spawnCreep(roles.claimer.body, newName, { memory: { role: 'claimer', invasionTarget: room.memory.invasionTarget, homeRoom: spawn.room.name } }) === OK) {
                    console.log(`Spawning new claimer: ${newName}`);
                    return;
                }
            }
        }
    }

    // 防御：当房间发现敌对 creep 时，生成 Defender 保卫房间
    if (room.find(FIND_HOSTILE_CREEPS).length > 0) {
        if (counts.defender < roles.defender.count) {
            const newName = `Defender_${Game.time}`;
            if (spawn.spawnCreep(roles.defender.body, newName, { memory: { role: 'defender', homeRoom: spawn.room.name } }) === OK) {
                console.log(`Spawning new defender: ${newName}`);
                return;
            }
        }
    }

    // 资源运送者：当房间生态稳定且不是主房间时，生成资源运送者
    if (room.name !== Memory.mainRoom && room.memory.transportResourcesToMainRoom && counts.transporter < roles.transporter.count) {
        const newName = `Transporter_${Game.time}`;
        if (spawn.spawnCreep(roles.transporter.body, newName, { memory: { role: 'transporter', homeRoom: spawn.room.name } }) === OK) {
            console.log(`Spawning new transporter: ${newName}`);
            return;
        }
    }
};