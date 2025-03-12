// roles/specializedHarvester.js
module.exports.run = function (creep) {
    if (creep.store.getFreeCapacity() > 0) {
        // 查找最近的 Source 进行采集
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }
    } else {
        // 当资源采集满了时，将资源丢在地上
        creep.drop(RESOURCE_ENERGY);
    }
};