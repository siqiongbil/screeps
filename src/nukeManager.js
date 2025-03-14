/**
 * 核弹发射井管理系统
 * 用于管理核弹发射井的装填、发射和状态监控
 */

module.exports = {
    // 主运行函数
    run: function(room) {
        // 每100个tick运行一次
        if(Game.time % 100 !== 0) return;
        
        // 检查房间控制器等级
        if(!room.controller || room.controller.level < 8) return;
        
        // 初始化内存
        if(!room.memory.nukeManager) {
            this.initializeMemory(room);
        }
        
        try {
            // 获取核弹发射井
            const nuker = this.getNuker(room);
            if(!nuker) return;
            
            // 更新核弹发射井状态
            this.updateNukerStatus(room, nuker);
            
            // 装填核弹发射井
            this.fillNuker(room, nuker);
            
            // 检查发射命令
            this.checkLaunchCommand(room, nuker);
            
            // 可视化核弹发射井状态
            this.visualizeNukerStatus(room, nuker);
        } catch(error) {
            console.log(`房间 ${room.name} 核弹管理系统错误：${error}`);
        }
    },
    
    // 初始化内存
    initializeMemory: function(room) {
        room.memory.nukeManager = {
            status: {
                ready: false,
                cooldown: 0,
                energyFilled: 0,
                ghodiumFilled: 0,
                lastUpdate: Game.time
            },
            targets: [],
            launchCommand: null
        };
    },
    
    // 获取核弹发射井
    getNuker: function(room) {
        return room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_NUKER
        })[0];
    },
    
    // 更新核弹发射井状态
    updateNukerStatus: function(room, nuker) {
        const nukeManager = room.memory.nukeManager;
        
        // 更新能量和G填充状态
        nukeManager.status.energyFilled = nuker.store[RESOURCE_ENERGY];
        nukeManager.status.ghodiumFilled = nuker.store[RESOURCE_GHODIUM];
        
        // 更新冷却时间
        nukeManager.status.cooldown = nuker.cooldown || 0;
        
        // 更新就绪状态
        nukeManager.status.ready = (
            nukeManager.status.energyFilled >= 300000 &&
            nukeManager.status.ghodiumFilled >= 5000 &&
            nukeManager.status.cooldown === 0
        );
        
        // 更新时间戳
        nukeManager.status.lastUpdate = Game.time;
        
        // 记录日志
        if(Game.time % 1000 === 0) {
            console.log(`[NukeManager] 房间 ${room.name} 核弹状态：
                能量: ${nukeManager.status.energyFilled}/300000
                G资源: ${nukeManager.status.ghodiumFilled}/5000
                冷却: ${nukeManager.status.cooldown}
                就绪: ${nukeManager.status.ready ? '是' : '否'}`
            );
        }
    },
    
    // 装填核弹发射井
    fillNuker: function(room, nuker) {
        // 如果已经满了，不需要装填
        if(nuker.store[RESOURCE_ENERGY] >= 300000 && nuker.store[RESOURCE_GHODIUM] >= 5000) {
            return;
        }
        
        // 检查是否有终端和存储
        const terminal = room.terminal;
        const storage = room.storage;
        
        if(!terminal && !storage) return;
        
        // 优先从终端获取资源
        if(terminal) {
            // 如果终端有足够的能量和G，添加装填任务
            if(terminal.store[RESOURCE_ENERGY] > 50000 && nuker.store[RESOURCE_ENERGY] < 300000) {
                this.addFillTask(room, RESOURCE_ENERGY);
            }
            
            if(terminal.store[RESOURCE_GHODIUM] > 0 && nuker.store[RESOURCE_GHODIUM] < 5000) {
                this.addFillTask(room, RESOURCE_GHODIUM);
            }
        }
        
        // 如果终端没有足够资源，从存储获取
        if(storage && nuker.store[RESOURCE_ENERGY] < 300000 && terminal && terminal.store[RESOURCE_ENERGY] <= 50000) {
            if(storage.store[RESOURCE_ENERGY] > 100000) {
                this.addFillTask(room, RESOURCE_ENERGY);
            }
        }
    },
    
    // 添加装填任务
    addFillTask: function(room, resourceType) {
        // 确保任务队列存在
        if(!room.memory.tasks) {
            room.memory.tasks = [];
        }
        
        // 检查是否已经有相同的任务
        const existingTask = room.memory.tasks.find(task => 
            task.type === 'fillNuker' && task.resourceType === resourceType
        );
        
        if(existingTask) return;
        
        // 添加新任务
        room.memory.tasks.push({
            id: `fillNuker_${resourceType}_${Game.time}`,
            type: 'fillNuker',
            resourceType: resourceType,
            priority: resourceType === RESOURCE_ENERGY ? 3 : 2, // G资源优先级更高
            creepCount: 1,
            created: Game.time
        });
        
        console.log(`[NukeManager] 添加核弹装填任务：${resourceType}`);
    },
    
    // 检查发射命令
    checkLaunchCommand: function(room, nuker) {
        const nukeManager = room.memory.nukeManager;
        
        // 如果没有发射命令，返回
        if(!nukeManager.launchCommand) return;
        
        // 检查核弹是否就绪
        if(!nukeManager.status.ready) {
            console.log(`[NukeManager] 核弹未就绪，无法发射`);
            return;
        }
        
        // 获取目标
        const target = nukeManager.launchCommand;
        
        // 检查目标是否有效
        if(!target.roomName || !target.x || !target.y) {
            console.log(`[NukeManager] 发射目标无效`);
            nukeManager.launchCommand = null;
            return;
        }
        
        // 检查目标是否是新手房间
        if(Game.map.getRoomStatus(target.roomName).status === 'normal') {
            // 尝试发射核弹
            const result = nuker.launchNuke(new RoomPosition(target.x, target.y, target.roomName));
            
            if(result === OK) {
                console.log(`[NukeManager] 核弹已发射，目标：${target.roomName} (${target.x},${target.y})`);
                
                // 记录发射历史
                if(!nukeManager.launchHistory) {
                    nukeManager.launchHistory = [];
                }
                
                nukeManager.launchHistory.push({
                    target: target,
                    time: Game.time,
                    landTime: Game.time + 50000
                });
                
                // 清除发射命令
                nukeManager.launchCommand = null;
            } else {
                console.log(`[NukeManager] 核弹发射失败，错误码：${result}`);
                
                // 如果是无效目标，清除发射命令
                if(result === ERR_INVALID_TARGET) {
                    nukeManager.launchCommand = null;
                }
            }
        } else {
            console.log(`[NukeManager] 无法向新手房间发射核弹`);
            nukeManager.launchCommand = null;
        }
    },
    
    // 可视化核弹发射井状态
    visualizeNukerStatus: function(room, nuker) {
        const nukeManager = room.memory.nukeManager;
        const visual = room.visual;
        
        // 绘制核弹发射井状态
        visual.circle(nuker.pos, {
            radius: 0.5,
            fill: nukeManager.status.ready ? '#00ff00' : '#ff0000',
            opacity: 0.5
        });
        
        // 显示能量和G填充状态
        const energyPercent = Math.floor((nukeManager.status.energyFilled / 300000) * 100);
        const ghodiumPercent = Math.floor((nukeManager.status.ghodiumFilled / 5000) * 100);
        
        visual.text(`E: ${energyPercent}% G: ${ghodiumPercent}%`, nuker.pos.x, nuker.pos.y - 0.5, {
            color: 'white',
            font: 0.4
        });
        
        // 如果有冷却时间，显示冷却时间
        if(nukeManager.status.cooldown > 0) {
            visual.text(`冷却: ${nukeManager.status.cooldown}`, nuker.pos.x, nuker.pos.y + 0.5, {
                color: 'white',
                font: 0.4
            });
        }
        
        // 如果有发射命令，显示目标
        if(nukeManager.launchCommand) {
            const target = nukeManager.launchCommand;
            visual.line(nuker.pos, new RoomPosition(25, 25, target.roomName), {
                color: '#ff0000',
                width: 0.2,
                opacity: 0.5
            });
        }
    },
    
    // 获取核弹状态报告
    getNukerReport: function(room) {
        const nukeManager = room.memory.nukeManager;
        if(!nukeManager) {
            return "核弹管理系统未初始化";
        }
        
        const nuker = this.getNuker(room);
        if(!nuker) {
            return "房间中没有核弹发射井";
        }
        
        // 生成报告
        let report = `=== 房间 ${room.name} 核弹状态报告 ===\n`;
        report += `能量: ${nukeManager.status.energyFilled}/300000 (${Math.floor((nukeManager.status.energyFilled / 300000) * 100)}%)\n`;
        report += `G资源: ${nukeManager.status.ghodiumFilled}/5000 (${Math.floor((nukeManager.status.ghodiumFilled / 5000) * 100)}%)\n`;
        report += `冷却: ${nukeManager.status.cooldown}\n`;
        report += `就绪: ${nukeManager.status.ready ? '是' : '否'}\n\n`;
        
        // 发射历史
        if(nukeManager.launchHistory && nukeManager.launchHistory.length > 0) {
            report += `发射历史:\n`;
            nukeManager.launchHistory.forEach(launch => {
                const timeLeft = launch.landTime - Game.time;
                report += `- 目标: ${launch.target.roomName} (${launch.target.x},${launch.target.y})\n`;
                report += `  发射时间: ${Game.time - launch.time} ticks前\n`;
                report += `  预计着陆: ${timeLeft > 0 ? `${timeLeft} ticks后` : '已着陆'}\n`;
            });
        }
        
        // 当前发射命令
        if(nukeManager.launchCommand) {
            report += `\n当前发射命令:\n`;
            report += `目标: ${nukeManager.launchCommand.roomName} (${nukeManager.launchCommand.x},${nukeManager.launchCommand.y})\n`;
        }
        
        return report;
    },
    
    // 设置发射目标
    setLaunchTarget: function(room, targetRoomName, x, y) {
        if(!room.memory.nukeManager) {
            this.initializeMemory(room);
        }
        
        // 检查目标是否有效
        if(!targetRoomName || !Game.map.getRoomStatus(targetRoomName)) {
            return `目标房间 ${targetRoomName} 无效`;
        }
        
        // 检查坐标是否有效
        if(x < 0 || x > 49 || y < 0 || y > 49) {
            return `坐标 (${x},${y}) 无效，必须在0-49范围内`;
        }
        
        // 检查是否是新手房间
        if(Game.map.getRoomStatus(targetRoomName).status !== 'normal') {
            return `无法向新手房间 ${targetRoomName} 发射核弹`;
        }
        
        // 设置发射命令
        room.memory.nukeManager.launchCommand = {
            roomName: targetRoomName,
            x: x,
            y: y,
            setTime: Game.time
        };
        
        return `已设置核弹发射目标：${targetRoomName} (${x},${y})`;
    },
    
    // 取消发射命令
    cancelLaunch: function(room) {
        if(!room.memory.nukeManager) {
            return "核弹管理系统未初始化";
        }
        
        if(!room.memory.nukeManager.launchCommand) {
            return "没有待执行的发射命令";
        }
        
        const target = room.memory.nukeManager.launchCommand;
        room.memory.nukeManager.launchCommand = null;
        
        return `已取消发射命令，目标：${target.roomName} (${target.x},${target.y})`;
    }
}; 