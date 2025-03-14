/**
 * 链接网络管理系统
 * 用于优化房间内的能量传输
 */

module.exports = {
    // 主运行函数
    run: function(room) {
        // 每3个tick运行一次
        if(Game.time % 3 !== 0) return;
        
        // 初始化内存
        if(!room.memory.linkNetwork) {
            this.initializeMemory(room);
        }
        
        try {
            // 分析链接网络
            this.analyzeLinks(room);
            
            // 执行能量传输
            this.transferEnergy(room);
            
            // 可视化链接网络
            if(Game.time % 20 === 0) {
                this.visualizeNetwork(room);
            }
        } catch(error) {
            console.log(`房间 ${room.name} 链接网络错误：${error}`);
        }
    },
    
    // 初始化内存
    initializeMemory: function(room) {
        room.memory.linkNetwork = {
            links: {
                senders: [],    // 发送能量的链接（通常靠近能量源）
                receivers: [],  // 接收能量的链接（通常靠近控制器或存储）
                storage: null   // 存储链接（靠近存储）
            },
            status: {
                lastTransfer: 0,
                efficiency: 0
            },
            stats: {
                transfers: 0,
                energyMoved: 0
            }
        };
    },
    
    // 分析链接网络
    analyzeLinks: function(room) {
        // 获取所有链接
        const links = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        });
        
        // 如果没有链接，跳过
        if(links.length < 2) return;
        
        const linkNetwork = room.memory.linkNetwork;
        
        // 重置链接列表
        linkNetwork.links.senders = [];
        linkNetwork.links.receivers = [];
        linkNetwork.links.storage = null;
        
        // 分析每个链接的位置和用途
        links.forEach(link => {
            // 靠近控制器的是接收者
            if(link.pos.getRangeTo(room.controller) <= 3) {
                linkNetwork.links.receivers.push(link.id);
            }
            // 靠近存储的是存储链接
            else if(room.storage && link.pos.getRangeTo(room.storage) <= 2) {
                linkNetwork.links.storage = link.id;
                linkNetwork.links.receivers.push(link.id);
            }
            // 靠近能量源的是发送者
            else {
                const sources = room.find(FIND_SOURCES);
                let isSender = false;
                
                for(let source of sources) {
                    if(link.pos.getRangeTo(source) <= 2) {
                        linkNetwork.links.senders.push(link.id);
                        isSender = true;
                        break;
                    }
                }
                
                // 如果不是靠近能量源的，检查是否靠近矿物
                if(!isSender) {
                    const minerals = room.find(FIND_MINERALS);
                    for(let mineral of minerals) {
                        if(link.pos.getRangeTo(mineral) <= 2) {
                            linkNetwork.links.senders.push(link.id);
                            isSender = true;
                            break;
                        }
                    }
                }
                
                // 如果不是发送者也不是接收者，默认为发送者
                if(!isSender && !linkNetwork.links.receivers.includes(link.id)) {
                    linkNetwork.links.senders.push(link.id);
                }
            }
        });
        
        // 确保存储链接也在接收者列表中
        if(linkNetwork.links.storage && !linkNetwork.links.receivers.includes(linkNetwork.links.storage)) {
            linkNetwork.links.receivers.push(linkNetwork.links.storage);
        }
        
        // 如果没有存储链接但有接收者，将第一个接收者设为存储链接
        if(!linkNetwork.links.storage && linkNetwork.links.receivers.length > 0) {
            linkNetwork.links.storage = linkNetwork.links.receivers[0];
        }
    },
    
    // 执行能量传输
    transferEnergy: function(room) {
        const linkNetwork = room.memory.linkNetwork;
        
        // 如果上次传输后冷却时间不足，跳过
        if(Game.time - linkNetwork.status.lastTransfer < 10) return;
        
        // 获取所有发送者和接收者
        const senders = linkNetwork.links.senders
            .map(id => Game.getObjectById(id))
            .filter(link => link && link.store[RESOURCE_ENERGY] >= 400);
            
        const receivers = linkNetwork.links.receivers
            .map(id => Game.getObjectById(id))
            .filter(link => link && link.store.getFreeCapacity(RESOURCE_ENERGY) >= 200);
            
        // 如果没有发送者或接收者，跳过
        if(senders.length === 0 || receivers.length === 0) return;
        
        // 优先级排序：存储链接 > 控制器链接 > 其他接收者
        receivers.sort((a, b) => {
            // 存储链接优先级最高
            if(a.id === linkNetwork.links.storage) return -1;
            if(b.id === linkNetwork.links.storage) return 1;
            
            // 其次是靠近控制器的链接
            const aToController = a.pos.getRangeTo(room.controller);
            const bToController = b.pos.getRangeTo(room.controller);
            return aToController - bToController;
        });
        
        // 发送者按能量量排序（能量最多的优先发送）
        senders.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);
        
        // 执行传输
        const sender = senders[0];
        const receiver = receivers[0];
        
        // 计算传输距离和冷却时间
        const distance = Math.max(
            Math.abs(sender.pos.x - receiver.pos.x),
            Math.abs(sender.pos.y - receiver.pos.y)
        );
        
        // 传输能量
        const result = sender.transferEnergy(receiver);
        
        if(result === OK) {
            // 更新状态
            linkNetwork.status.lastTransfer = Game.time;
            linkNetwork.stats.transfers++;
            linkNetwork.stats.energyMoved += Math.min(sender.store[RESOURCE_ENERGY], receiver.store.getFreeCapacity(RESOURCE_ENERGY));
            
            // 计算效率（传输的能量 / 链接容量）
            const efficiency = Math.min(sender.store[RESOURCE_ENERGY], receiver.store.getFreeCapacity(RESOURCE_ENERGY)) / 800;
            linkNetwork.status.efficiency = efficiency;
            
            // 记录日志
            if(Game.time % 100 === 0) {
                console.log(`[LinkNetwork] 房间 ${room.name} 链接传输：${sender.id.substr(0, 6)} -> ${receiver.id.substr(0, 6)}, 距离: ${distance}, 效率: ${(efficiency * 100).toFixed(2)}%`);
            }
        }
    },
    
    // 可视化链接网络
    visualizeNetwork: function(room) {
        const linkNetwork = room.memory.linkNetwork;
        const visual = room.visual;
        
        // 获取所有链接
        const senders = linkNetwork.links.senders
            .map(id => Game.getObjectById(id))
            .filter(link => link);
            
        const receivers = linkNetwork.links.receivers
            .map(id => Game.getObjectById(id))
            .filter(link => link);
            
        const storageLink = linkNetwork.links.storage ? Game.getObjectById(linkNetwork.links.storage) : null;
        
        // 绘制发送者
        senders.forEach(link => {
            visual.circle(link.pos, {
                radius: 0.5,
                fill: '#ff0000',
                opacity: 0.5
            });
            
            // 显示能量量
            visual.text(`${link.store[RESOURCE_ENERGY]}`, link.pos.x, link.pos.y - 0.5, {
                color: 'white',
                font: 0.4
            });
        });
        
        // 绘制接收者
        receivers.forEach(link => {
            if(link.id === linkNetwork.links.storage) return; // 存储链接单独绘制
            
            visual.circle(link.pos, {
                radius: 0.5,
                fill: '#00ff00',
                opacity: 0.5
            });
            
            // 显示能量量
            visual.text(`${link.store[RESOURCE_ENERGY]}`, link.pos.x, link.pos.y - 0.5, {
                color: 'white',
                font: 0.4
            });
        });
        
        // 绘制存储链接
        if(storageLink) {
            visual.circle(storageLink.pos, {
                radius: 0.5,
                fill: '#0000ff',
                opacity: 0.5
            });
            
            // 显示能量量
            visual.text(`${storageLink.store[RESOURCE_ENERGY]}`, storageLink.pos.x, storageLink.pos.y - 0.5, {
                color: 'white',
                font: 0.4
            });
        }
        
        // 绘制连接线
        senders.forEach(sender => {
            receivers.forEach(receiver => {
                visual.line(sender.pos, receiver.pos, {
                    color: '#ffff00',
                    opacity: 0.2,
                    width: 0.1
                });
            });
        });
        
        // 显示网络状态
        visual.text(
            `链接网络: ${senders.length}发送 ${receivers.length}接收 效率:${(linkNetwork.status.efficiency * 100).toFixed(0)}%`,
            1, 1, {
                color: 'white',
                font: 0.5,
                align: 'left'
            }
        );
    },
    
    // 获取链接网络状态报告
    getNetworkReport: function(room) {
        const linkNetwork = room.memory.linkNetwork;
        
        if(!linkNetwork) {
            return "链接网络未初始化";
        }
        
        // 获取所有链接
        const senders = linkNetwork.links.senders
            .map(id => Game.getObjectById(id))
            .filter(link => link);
            
        const receivers = linkNetwork.links.receivers
            .map(id => Game.getObjectById(id))
            .filter(link => link);
            
        const storageLink = linkNetwork.links.storage ? Game.getObjectById(linkNetwork.links.storage) : null;
        
        // 生成报告
        let report = `=== 房间 ${room.name} 链接网络状态报告 ===\n`;
        report += `发送者: ${senders.length}\n`;
        report += `接收者: ${receivers.length}\n`;
        report += `存储链接: ${storageLink ? '已配置' : '未配置'}\n`;
        report += `效率: ${(linkNetwork.status.efficiency * 100).toFixed(2)}%\n`;
        report += `上次传输: ${Game.time - linkNetwork.status.lastTransfer} ticks前\n`;
        report += `总传输次数: ${linkNetwork.stats.transfers}\n`;
        report += `总传输能量: ${linkNetwork.stats.energyMoved}\n\n`;
        
        // 发送者详情
        report += `发送者详情:\n`;
        senders.forEach(link => {
            report += `- ID ${link.id.substr(0, 6)}: ${link.store[RESOURCE_ENERGY]}/${link.store.getCapacity(RESOURCE_ENERGY)} 能量\n`;
        });
        
        // 接收者详情
        report += `\n接收者详情:\n`;
        receivers.forEach(link => {
            report += `- ID ${link.id.substr(0, 6)}: ${link.store[RESOURCE_ENERGY]}/${link.store.getCapacity(RESOURCE_ENERGY)} 能量\n`;
        });
        
        return report;
    }
}; 