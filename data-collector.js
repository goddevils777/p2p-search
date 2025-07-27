const fs = require('fs');
const path = require('path');

class DataCollector {
    constructor() {
        this.dataFile = path.join(__dirname, 'price_data.csv');
        this.initDataFile();
    }

    initDataFile() {
        // Создаем CSV файл с заголовками если не существует
        if (!fs.existsSync(this.dataFile)) {
            const headers = [
                'timestamp',
                'date',
                'time', 
                'hour',
                'dayOfWeek',
                'buyPrice',
                'sellPrice',
                'spread',
                'spreadPercent',
                'buyerName',
                'sellerName',
                'minAmount',
                'selectedBank'
            ].join(',') + '\n';
            
            fs.writeFileSync(this.dataFile, headers);
            console.log('📊 Создан файл для сбора данных:', this.dataFile);
        }
    }

    saveData(buyData, sellData, minAmount, selectedBank) {
        try {
            const now = new Date();
            const timestamp = now.toISOString();
            const date = now.toDateString();
            const time = now.toTimeString().split(' ')[0]; // HH:MM:SS
            const hour = now.getHours();
            const dayOfWeek = now.toLocaleDateString('ru', { weekday: 'long' });

            // Извлекаем данные из Bybit структуры
            const buyAds = buyData.result?.items || [];
            const sellAds = sellData.result?.items || [];

            let buyPrice = 0;
            let sellPrice = 0;
            let buyerName = '';
            let sellerName = '';

            // Берем 3-е объявление (индекс 2), если есть, иначе первое
            if (buyAds.length > 2 && buyAds[2].price) {
                buyPrice = parseFloat(buyAds[2].price);
                buyerName = buyAds[2].nickName || 'Неизвестно';
            } else if (buyAds.length > 0 && buyAds[0].price) {
                buyPrice = parseFloat(buyAds[0].price);
                buyerName = buyAds[0].nickName || 'Неизвестно';
            }

            if (sellAds.length > 2 && sellAds[2].price) {
                sellPrice = parseFloat(sellAds[2].price);
                sellerName = sellAds[2].nickName || 'Неизвестно';
            } else if (sellAds.length > 0 && sellAds[0].price) {
                sellPrice = parseFloat(sellAds[0].price);
                sellerName = sellAds[0].nickName || 'Неизвестно';
            }

            // Рассчитываем спред
            const spread = sellPrice - buyPrice;
            const spreadPercent = buyPrice > 0 ? ((spread / buyPrice) * 100).toFixed(2) : 0;

            // Формируем строку данных
            const dataRow = [
                timestamp,
                date,
                time,
                hour,
                dayOfWeek,
                buyPrice.toFixed(2),
                sellPrice.toFixed(2),
                spread.toFixed(2),
                spreadPercent,
                `"${buyerName}"`, // Кавычки для безопасности CSV
                `"${sellerName}"`,
                minAmount,
                selectedBank || 'все'
            ].join(',') + '\n';

            // Добавляем в файл
            fs.appendFileSync(this.dataFile, dataRow);

            console.log(`💾 Данные сохранены: ${time} | Покупка: ${buyPrice.toFixed(2)} ₴ | Продажа: ${sellPrice.toFixed(2)} ₴ | Спред: ${spreadPercent}%`);

        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
        }
    }

    getAnalytics() {
        try {
            if (!fs.existsSync(this.dataFile)) {
                return { message: 'Нет данных для анализа' };
            }

            const data = fs.readFileSync(this.dataFile, 'utf8');
            const lines = data.split('\n').filter(line => line.trim());
            const totalRecords = lines.length - 1; // Минус заголовок

            if (totalRecords === 0) {
                return { message: 'Нет данных для анализа' };
            }

            // Простая аналитика по часам
            const hourlyData = {};
            
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length >= 9) {
                    const hour = parseInt(cols[3]);
                    const buyPrice = parseFloat(cols[5]);
                    const sellPrice = parseFloat(cols[6]);
                    const spreadPercent = parseFloat(cols[8]);

                    if (!hourlyData[hour]) {
                        hourlyData[hour] = {
                            count: 0,
                            avgBuyPrice: 0,
                            avgSellPrice: 0,
                            avgSpread: 0,
                            minBuyPrice: buyPrice,
                            maxSellPrice: sellPrice
                        };
                    }

                    const hd = hourlyData[hour];
                    hd.count++;
                    hd.avgBuyPrice = (hd.avgBuyPrice * (hd.count - 1) + buyPrice) / hd.count;
                    hd.avgSellPrice = (hd.avgSellPrice * (hd.count - 1) + sellPrice) / hd.count;
                    hd.avgSpread = (hd.avgSpread * (hd.count - 1) + spreadPercent) / hd.count;
                    hd.minBuyPrice = Math.min(hd.minBuyPrice, buyPrice);
                    hd.maxSellPrice = Math.max(hd.maxSellPrice, sellPrice);
                }
            }

            return {
                totalRecords,
                hourlyData,
                message: `Собрано ${totalRecords} записей данных`
            };

        } catch (error) {
            console.error('❌ Ошибка анализа данных:', error);
            return { error: error.message };
        }
    }
}

module.exports = DataCollector;