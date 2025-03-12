// linkManager.js
// LinkManager 角色：管理 Link 之间的能量传输
const utils = require('./utils');

module.exports.run = function (creep) {
    if (!utils.ensureInHomeRoom(creep)) return;

    const links = creep.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });
    if (links.length < 2) return; // 至少需要两个 Link

    const sourceLink = links[0]; // 假设第一个 Link 作为源
    const targetLink = links[1]; // 假设第二个 Link 作为目标

    if (sourceLink.energy > sourceLink.energyCapacity / 2 && targetLink.energy < targetLink.energyCapacity) {
        sourceLink.transferEnergy(targetLink);
    }
};