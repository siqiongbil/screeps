module.exports = {
    run: function(creep) {
        // 使用原型方法更新工作状态
        creep.updateWorkingState();

        // 如果在工作状态，就去转移能量
        if(creep.memory.working) {
            // 使用原型方法转移能量
            if(!creep.transferEnergy()) {
                // 如果没有建筑需要能量，就去升级控制器
                if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {
                        visualizePathStyle: {stroke: '#ffffff'},
                        reusePath: 5
                    });
                }
            }
        }
        else {
            // 先尝试从容器获取能量
            if(creep.withdrawFromContainer()) {
                return;
            }
            
            // 如果没有可用的容器，再从能量源采集
            creep.harvestOptimalSource();
        }
    }
}; 