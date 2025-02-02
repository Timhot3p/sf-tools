class GenericTab extends Tab {
    constructor (parent, showOptions) {
        super(parent);

        this.showOptions = showOptions;
    }

    show () {
        $('#floating-opts').toggle(this.showOptions);
    }
}

Site.ready({ name: 'attributes' }, function () {
    UI.register([
        {
            tab: new GenericTab('tab-gold-experience', false),
            tabName: 'gold_experience',
            buttonId: 'show-attributes'
        },
        {
            tab: new GenericTab('tab-fortress', true),
            tabName: 'fortress',
            buttonId: 'show-fortress'
        },
        {
            tab: new GenericTab('tab-underworld', true),
            tabName: 'underworld',
            buttonId: 'show-underworld'
        },
        {
            tab: new GenericTab('tab-gold-table', false),
            tabName: 'gold_table',
            buttonId: 'show-gold-table'
        }
    ], {
        defaultTab: 'gold_experience'
    });

    function updateTimers (lq) {
        $('[data-lq]').each((_, el) => {
            let duration = buildTime(parseInt(el.dataset.lq), lq, el.dataset.uw);
            el.innerText = formatFancyTime(duration);
        });

        $('[data-lg]').each((_, el) => {
            let duration = parseInt(el.dataset.lg) * (1 - lq * 0.05);
            el.innerText = formatFancyTime(duration);
        });
    }

    function getAcademyValues (level, academy) {
        const hourly = Calculations.experienceAcademyHourly(level, academy);
        const capacity = Calculations.experienceAcademyCapacity(level, academy);
        const time = capacity / hourly;

        return [hourly, capacity, time * 3600000];
    }

    function getGoldPitValues (level, pit) {
        const hourly = Calculations.goldPitHourly(level, pit);
        const capacity = Calculations.goldPitCapacity(level, pit);
        const time = 3600000 * capacity / hourly;

        return [capacity, hourly, time];
    }

    function updateLevels (lvl) {
        $('[data-level-academy-hourly]').each((_, el) => {
            let academy = parseInt(el.dataset.levelAcademyHourly);
            let [hourly, capacity, time] = getAcademyValues(lvl, academy);
            el.innerText = formatAsSpacedNumber(hourly, ' ');
        });

        $('[data-level-academy-storage]').each((_, el) => {
            let academy = parseInt(el.dataset.levelAcademyStorage);
            let [hourly, capacity, time] = getAcademyValues(lvl, academy);
            el.innerText = formatAsSpacedNumber(capacity, ' ');
        });

        $('[data-level-academy-fill]').each((_, el) => {
            let academy = parseInt(el.dataset.levelAcademyFill);
            let [hourly, capacity, time] = getAcademyValues(lvl, academy);
            el.innerText = formatFancyTime(time);
        });

        $('[data-level-pit-storage]').each((_, el) => {
            let pit = parseInt(el.dataset.levelPitStorage);
            let [capacity, hourly, time] = getGoldPitValues(lvl, pit);
            el.innerText = formatAsSpacedNumber(capacity, ' ');
        });

        $('[data-level-pit-hourly]').each((_, el) => {
            let pit = parseInt(el.dataset.levelPitHourly);
            let [capacity, hourly, time] = getGoldPitValues(lvl, pit);
            el.innerText = formatAsSpacedNumber(hourly, ' ');
        });

        $('[data-level-pit-fill]').each((_, el) => {
            let pit = parseInt(el.dataset.levelPitFill);
            let [capacity, hourly, time] = getGoldPitValues(lvl, pit);
            el.innerText = formatFancyTime(time);
        });
    }

    function bindCallback (id, min, max, callback) {
        let $el = $(id);
        $el.on('change input', () => {
            if (validate($el)) {
                callback(getClampedValue(id, min, max));
            }
        });
    }

    bindCallback('#fortress-lq', 0, 15, (lq) => updateTimers(lq));
    bindCallback('#fortress-level', 1, 800, (lvl) => updateLevels(lvl));

    function generateTable (table, rows, generators, extra_rows, excludeBT = false, uwTime = false) {
        let content = '';
        for (let [index, data] of Object.entries(rows)) {
            let level = parseInt(index) + 1;

            let generatedContent = '';
            if (Array.isArray(data)) {
                for (let g of generators) generatedContent += `<td>${g(level, ...data)}</td>`
            } else {
                for (let g of generators) generatedContent += `<td>${g(level, data)}</td>`
            }

            content += `<tr>
                <td>${level}</td>
                ${excludeBT ? '' : `<td data-lq="${level}"${uwTime ? 'data-uw="true"' : ''}></td>`}
                ${generatedContent}
            </tr>`;
        }
        if (extra_rows) {
            content += extra_rows;
        }
        $(`#${table}`).html(content);
    }

    // Underworld
    (function () {
        const HEART = [
            0, 616, 1650, 4220, 11000, 25080, 45930, 84150, 198000, 439550, 902850, 2043300, 4118400, 7722000, 16632000
        ];
        generateTable('underworld-heart', HEART, [
            (level, souls) => level == 1 ? 0 : formatAsSpacedNumber(level * 1000),
            (level, souls) => formatAsSpacedNumber(souls),
            () => ''
        ]);

        const GATE = [
            0, 55, 149, 380, 990, 2255, 4820, 10090, 26730, 65930, 135400, 306500, 617750, 1158300, 2494800
        ];
        generateTable('underworld-gate', GATE, [
            (level, souls) => formatAsSpacedNumber(level * 500),
            (level, souls) => formatAsSpacedNumber(souls),
            (level, souls) => Math.min(5, level),
            (level, souls) => `${100 + Math.max(0, (level - 5) * 20)} %`,
            () => ''
        ]);

        const GOLD_PIT = [
            12, 46, 124, 317, 825, 1880, 4015, 8415, 19800, 43950, 90280, 204300, 411800, 772200, 1663200, 162518400
        ].concat(Array(84).fill(162518400));
        generateTable('underworld-goldpit', GOLD_PIT, [
            (level, souls) => formatAsSpacedNumber(level > 15 ? 10E6 : (level * 1000)),
            (level, souls) => formatAsSpacedNumber(souls),
            (level) => `<span data-level-pit-storage="${level}"></span>`,
            (level) => `<span data-level-pit-hourly="${level}"></span>`,
            (level) => `<span data-level-pit-fill="${level}"></span>`
        ], undefined, false, true);

        const EXTRACTOR = [
            [0, 165, 412, 3804], [462, 231, 635, 10890], [1235, 330, 990, 27456], [3165, 528, 1716, 60648], [8250, 825, 2887, 122252],
            [18810, 1254, 4702, 237336], [40190, 1914, 7656, 504900], [84150, 2805, 14025, 1014750], [198000, 4125, 24750, 2246640], [439550, 6105, 48840, 4796550],
            [902850, 9405, 94050, 9535680], [2043300, 14190, 170280, 20935200], [4118400, 21450, 343200, 42471000], [7722000, 32175, 643500, 84348000], [16632000, 49500, 1188000, 162518400]
        ];
        generateTable('underworld-extractor', EXTRACTOR, [
            (level, souls, hourly, storage) => formatAsSpacedNumber(level * 250),
            (level, souls, hourly, storage) => formatAsSpacedNumber(souls),
            (level, souls, hourly, storage) => formatAsSpacedNumber(hourly),
            (level, souls, hourly, storage) => formatAsSpacedNumber(storage),
            (level, souls, hourly, storage) => formatFancyTime(3600000 * storage / hourly),
            (level, souls, hourly, storage, capacity) => formatAsSpacedNumber(capacity)
        ]);

        const GOBLIN_PIT = [
            [0, 1], [396, 2], [1060, 3], [2715, 4], [7070, 5],
            [16120, 5], [34450, 5], [63110, 5], [148500, 5], [329650, 5],
            [677150, 5], [1532500, 5], [3088800, 5], [5791500, 5], [12474000, 5]
        ]
        generateTable('underworld-goblinpit', GOBLIN_PIT, [
            (level, souls, goblins) => formatAsSpacedNumber(level * 400),
            (level, souls, goblins) => formatAsSpacedNumber(souls),
            (level, souls, goblins) => goblins,
            () => ''
        ]);

        const TROLL_BLOCK = [
            [165, 1], [616, 1], [1650, 1], [4220, 1], [11000, 1],
            [25080, 1], [45930, 1], [84150, 1], [198000, 2], [439550, 2],
            [902850, 2], [2043300, 2], [4118400, 3], [7722000, 3], [16632000, 4]
        ];
        generateTable('underworld-trolls', TROLL_BLOCK, [
            (level, souls, trolls) => formatAsSpacedNumber(level * 990),
            (level, souls, trolls) => formatAsSpacedNumber(souls),
            (level, souls, trolls) => trolls,
            () => ''
        ]);

        const TORTURE_CHAMBER = [
            148, 554, 1485, 3800, 9900, 22570, 41340, 75730, 178200, 395600, 812550, 1839000, 3706500, 6949800, 14968500
        ];
        generateTable('underworld-torture', TORTURE_CHAMBER, [
            (level, souls) => formatAsSpacedNumber(level * 660),
            (level, souls) => formatAsSpacedNumber(souls),
            (level, souls) => `${100 + (level * 10)} %`,
            () => ''
        ]);

        const KEEPER = [
            198, 739, 1980, 5065, 13200, 25080, 45930, 84150, 198000, 439550, 902850, 2043300, 4118400, 7722000, 16632000
        ];
        generateTable('underworld-keeper', KEEPER, [
            (level, souls) => formatAsSpacedNumber(level * 1500),
            (level, souls) => formatAsSpacedNumber(souls),
            () => ''
        ]);

        const GLADIATOR_TRAINER = [
            148, 554, 1485, 3800, 9900, 22570, 48230, 100950, 237600, 527450, 1083400, 2452000, 4942000, 9266400, 19958000
        ];
        generateTable('underworld-gladiator', GLADIATOR_TRAINER, [
            (level, souls) => formatAsSpacedNumber(level * 700),
            (level, souls) => formatAsSpacedNumber(souls),
            (level, souls) => `${100 + (level * 5)} %`,
            () => ''
        ]);

        const TIME_MACHINE = [
            297, 1105, 2970, 5700, 11880, 22570, 41340, 75730, 178200, 395600, 812550, 1839000, 3706500, 6949800, 14968500
        ];
        generateTable('underworld-timemachine', TIME_MACHINE, [
            (level, souls) => formatAsSpacedNumber(level * 10000),
            (level, souls) => formatAsSpacedNumber(souls),
            (level, souls) => level > 10 ? (10 + (level - 10) * 2) : level,
            (level, souls) => 4 * (level > 10 ? (10 + (level - 10) * 2) : level),
            (level, souls) => 100 * (level > 10 ? (10 + (level - 10) * 2) : level)
        ]);
    })();

    // Fortress
    (function () {
        const FORTRESS = [
            [0, 0, 900, 300], [150, 50, 1760, 560], [440, 140, 3300, 1000],
            [1100, 333, 6000, 1920], [2500, 800, 12000, 4000], [6000, 2000, 23000, 7600],
            [13417, 4433, 40800, 13920], [27200, 9280, 76500, 25500], [57375, 19125, 184800, 60000],
            [154000, 50000, 414000, 133200], [379500, 122100, 830400, 273600], [830400, 273600, 1872000, 619200],
            [1872000, 619200, 3744000, 1248000], [3744000, 1248000, 7200000, 2340000], [7200000, 2340000, 15120000, 5040000],
            [15120000, 5040000, 27350000, 9000000], [27350000, 9000000, 50000000, 17500000], [50000000, 17500000, 90000000, 30000000],
            [90000000, 30000000, 165000000, 54000000], [165000000, 54000000, 300000000, 100000000]
        ]
        generateTable('fortress-fortress', FORTRESS, [
            (level, wood, stone, mwood, mstone) => formatAsSpacedNumber(level * 10),
            (level, wood, stone, mwood, mstone) => formatAsSpacedNumber(wood),
            (level, wood, stone, mwood, mstone) => formatAsSpacedNumber(stone),
            (level, wood, stone, mwood, mstone) => formatAsSpacedNumber(mwood),
            (level, wood, stone, mwood, mstone) => formatAsSpacedNumber(mstone)
        ]);

        const QUARTERS = [
            [35, 12], [138, 46], [406, 129], [1015, 308], [2308, 738],
            [5538, 1846], [12385, 4092], [25108, 8566], [52962, 17654], [142154, 46154],
            [350308, 112708], [766523, 252554], [1872000, 619200], [3744000, 1248000], [7200000, 2340000]
        ];
        generateTable('fortress-quarters', QUARTERS, [
            (level, wood, stone) => level,
            (level, wood, stone) => formatAsSpacedNumber(level * 5),
            (level, wood, stone) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone),
            (level, wood, stone) => `${level * 5} %`,
            () => ''
        ]);

        const WOODCUTTER = [
            [0, 0, 375, 150], [30, 20, 605, 220], [88, 56, 990, 330], [220, 133, 1625, 500],
            [500, 320, 2625, 750], [1200, 800, 4312, 1150], [2683, 1773, 6800, 1700],
            [5440, 3712, 12750, 2550], [11475, 7650, 23100, 3850], [30800, 20000, 46000, 5750],
            [75900, 48840, 86500, 8650], [166080, 109440, 156000, 13000], [405600, 268320, 312000, 19500],
            [873600, 582400, 600000, 30000], [1800000, 1170000, 1080000, 45000], [3780000, 2520000, 1687500, 67500],
            [6837500, 4500000, 2600000, 100000], [12500000, 8750000, 4050000, 150000],
            [22500000, 15000000, 6300000, 225000], [41250000, 27000000, 10500000, 350000]
        ];
        generateTable('fortress-woodcutter', WOODCUTTER, [
            (level, wood, stone, cap, hourly) => level,
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(level * 2),
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(wood),
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(stone),
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(hourly),
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(cap),
            (level, wood, stone, cap, hourly) => formatFancyTime(3600000 * cap / hourly),
            () => ''
        ]);

        const QUARRY = [
            [22, 0, 125, 50], [90, 16, 192, 70], [264, 45, 300, 100],
            [660, 107, 520, 160], [1500, 256, 875, 250], [3600, 640, 1425, 380],
            [8050, 1419, 2320, 580], [16320, 2970, 4250, 850], [34425, 6120, 7500, 1250],
            [92400, 16000, 14800, 1850], [227700, 39072, 28500, 2850], [498240, 87552, 51600, 4300],
            [1216800, 214656, 104000, 6500], [2620800, 465920, 195000, 9750], [5400000, 936000, 360000, 15000],
            [11340000, 2016000, 562500, 22500], [20512500, 3600000, 858000, 33000], [37500000, 7000000, 1350000, 50000],
            [67500000, 12000000, 2100000, 75000], [123750000, 21600000, 3450000, 115000]
        ];
        generateTable('fortress-quarry', QUARRY, [
            (level, wood, stone, cap, hourly) => level,
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(level * 3),
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(wood),
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(stone),
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(hourly),
            (level, wood, stone, cap, hourly) => formatAsSpacedNumber(cap),
            (level, wood, stone, cap, hourly) => formatFancyTime(3600000 * cap / hourly),
            () => ''
        ]);

        const GEMTIME = [60, 120, 180, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1440, 1680, 1920, 1800, 1680, 1560, 1530, 1500];
        const GEMMINE = [
            [50, 17, 2, 1], [200, 67, 10, 3], [587, 187, 29, 9], [1467, 444, 73, 22],
            [3333, 1067, 167, 53], [8000, 2667, 400, 133], [17889, 5911, 894, 296],
            [36267, 12373, 1813, 619], [76500, 25500, 3825, 1275], [184800, 60000, 9240, 3000],
            [414000, 133200, 20700, 6660], [830400, 273600, 41520, 13680], [1872000, 619200, 93600, 30960],
            [3744000, 1248000, 187200, 62400], [7200000, 2340000, 360000, 117000],
            [15120000, 5040000, 756000, 252000], [27350000, 9000000, 1367500, 450000],
            [50000000, 17500000, 2500000, 875000], [90000000, 30000000, 4500000, 1500000],
            [165000000, 54000000, 4500000, 1500000], [300000000, 100000000, 4500000, 1500000]
        ];
        generateTable('fortress-gemmine', GEMMINE, [
            (level, wood, stone, gwood, gstone) => Math.min(20, Math.max(3, level)),
            (level) => formatAsSpacedNumber(level > 20 ? 10E6 : (level * 15)),
            (level, wood) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone),
            (level) => formatAsSpacedNumber(Math.min(3000, level * 150)),
            (level, wood, stone, gwood) => formatAsSpacedNumber(gwood),
            (level, wood, stone, gwood, gstone) => formatAsSpacedNumber(gstone),
            (level) => `<span data-lg="${GEMTIME[Math.min(19, level - 1)] * 60000}"></span>`
        ], `
            <tr><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td></tr>
            <tr><td>100</td><td data-lq="100"></td><td>20</td><td>10 000 000</td><td>300 000 000</td><td>100 000 000</td><td>3 000</td><td>4 500 000</td><td>1 500 000</td><td><span data-lg="90000000"></span></td></tr>
        `);

        const ACADEMY = [
            [7, 9], [28, 37], [81, 103], [203, 246], [462, 591], [1108, 1477], [2477, 3247],
            [5022, 6853], [10592, 14123], [28431, 36923], [70062, 90166], [153305, 202043],
            [374400, 495360], [748800, 998400], [1440000, 1872000], [3024000, 4032000],
            [5470000, 7200000], [10000000, 14000000], [18000000, 24000000], [33000000, 43000000]
        ];
        generateTable('fortress-academy', ACADEMY, [
            (level) => Math.max(6, level),
            (level) => formatAsSpacedNumber(level * 7),
            (level, wood) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone),
            (level) => `<span data-level-academy-hourly="${level}"></span>`,
            (level) => `<span data-level-academy-storage="${level}"></span>`,
            (level) => `<span data-level-academy-fill="${level}"></span>`,
            (level) => ''
        ]);

        const ARCHERY = [
            [41, 7], [164, 27], [480, 76], [1200, 182], [2727, 436], [6545, 1091],
            [14636, 2418], [29673, 5062], [62591, 10432], [168000, 27273], [414000, 66600],
            [830400, 136800], [1872000, 309600], [3744000, 624000], [7200000, 1170000]
        ];
        generateTable('fortress-archery', ARCHERY, [
            (level) => Math.max(5, level),
            (level) => formatAsSpacedNumber(level * 5),
            (level, wood) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone),
            (level) => level * 2,
            (level) => ''
        ]);

        const BARRACKS = [
            [20, 14], [82, 55], [240, 153], [600, 364], [1364, 873], [3273, 2182],
            [7318, 4836], [14836, 10124], [31295, 20864], [84000, 54545], [207000, 133200],
            [415200, 273600], [936000, 619200], [1872000, 1248000], [3600000, 2340000]
        ];
        generateTable('fortress-barracks', BARRACKS, [
            (level) => Math.max(4, level),
            (level) => formatAsSpacedNumber(level * 5),
            (level, wood) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone),
            (level) => level * 3,
            (level) => ''
        ]);

        const MAGES = [
            [61, 20], [240, 76], [675, 205], [1636, 524], [4091, 1364], [9409, 3109],
            [19473, 6644], [41727, 13909], [113400, 36818], [282273, 90818], [622800, 205200],
            [1404000, 464400], [2808000, 936000], [5400000, 1755000], [11340000, 3780000]
        ];
        generateTable('fortress-mages', MAGES, [
            (level) => Math.max(7, level),
            (level) => formatAsSpacedNumber(level * 6),
            (level, wood) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone),
            (level) => level,
            (level) => ''
        ]);

        const TREASURY = [
            [40, 13], [160, 53], [469, 149], [1173, 356], [2667, 853], [6400, 2133],
            [14311, 4729], [29013, 9899], [61200, 20400], [147840, 48000], [331200, 106560],
            [664320, 218880], [1497600, 495360], [2995200, 998400], [5760000, 1872000]
        ];
        generateTable('fortress-treasury', TREASURY, [
            (level) => Math.max(2, level),
            (level) => formatAsSpacedNumber(Math.min(level, 15) * 25),
            (level, wood) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone),
            (level) => 5 + level,
            (level) => ''
        ], `
            <tr><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td>...</td><td></td></tr>
            <tr><td>45</td><td data-lq="15"></td><td>20</td><td>3 750</td><td>5 760 000</td><td>1 872 000</td><td>50</td><td></td></tr>
        `);

        const SMITHY = [
            [25, 8], [100, 33], [293, 93], [733, 222], [1667, 533], [4000, 1333],
            [8944, 2956], [18133, 6187], [38250, 12750], [92400, 30000], [207000, 66600],
            [415200, 136800], [936000, 309600], [1872000, 624000], [3600000, 1170000],
            [7560000, 2520000], [13675000, 4500000], [25000000, 8750000], [45000000, 15000000],
            [82500000, 27000000]
        ];
        generateTable('fortress-smithy', SMITHY, [
            (level) => Math.max(7, level),
            (level) => formatAsSpacedNumber(level * 4),
            (level, wood) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone),
            (level) => ''
        ]);

        const WALL = [
            [30, 13, 10], [120, 53, 18], [352, 149, 25], [880, 356, 29], [2000, 853, 35],
            [4800, 2133, 40], [10733, 4729, 50], [21760, 9899, 62], [45900, 20400, 76],
            [110880, 48000, 88], [248400, 106560, 102], [498240, 218880, 118],
            [1123200, 495360, 135], [2246400, 998400, 153], [4320000, 1872000, 170],
            [9072000, 4032000, 180], [16410000, 7200000, 185], [30000000, 14000000, 190],
            [54000000, 24000000, 195], [99000000, 43200000, 200]
        ];
        generateTable('fortress-wall', WALL, [
            (level) => Math.max(4, level),
            (level) => formatAsSpacedNumber(level * 15),
            (level, wood) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone),
            (level, wood, stone, flevel) => flevel,
            (level) => ''
        ]);

        const KNIGHTS = [
            [720, 240], [1408, 448], [2640, 800], [4800, 1536], [9600, 3200],
            [18400, 6080], [32640, 11136], [61200, 20400], [147840, 48000], [331200, 106560],
            [664320, 218880], [1497600, 495360], [2995200, 998400], [5760000, 1872000],
            [12096000, 4032000], [21880000, 7200000], [40000000, 14000000], [72000000, 24000000],
            [132000000, 43200000], [240000000, 80000000]
        ];
        generateTable('fortress-knights', KNIGHTS, [
            (level) => level,
            (level, wood) => formatAsSpacedNumber(wood),
            (level, wood, stone) => formatAsSpacedNumber(stone)
        ], undefined, true);
    })();

    function formatFancyTime (duration) {
        duration = Math.ceil(duration);

        let days = Math.trunc(duration / (1000 * 60 * 60 * 24));
        let hours = Math.trunc((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        let minutes = Math.trunc((duration % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.trunc((duration % (1000 * 60)) / 1000);

        if (days > 100) {
            return '-';
        }

        let str = [];
        if (days > 0) str.push(`${days}d`);
        if (hours > 0) str.push(`${hours}h`);
        if (minutes > 0) str.push(`${minutes}m`);
        if (seconds > 0) str.push(`${seconds}s`);

        return str.slice(0, 2).join(' ');
    }

    $('#fortress-lq, #fortress-level').trigger('input');

    function validate (... elements) {
        return elements.reduce((errors, element) => {
            if (isNaN($(element).val()) || $(element).val() < 0) {
                $(element).closest('.field').addClass('error');
                return errors + 1;
            } else {
                $(element).closest('.field').removeClass('error');
                return errors;
            }
        }, 0) == 0;
    }

    function roundShort(value) {
        return Math.ceil(value * 100) / 100;
    }

    function formatValue(value, delimiter = ' ') {
        return value >= 999 ? formatAsSpacedNumber(value, delimiter) : roundShort(value)
    }

    function ceilTo (value, step = 1) {
        return Math.ceil(value / step) * step;
    }

    function buildTime (level, lq, uw = false) {
        let mult = 1 - 0.05 * lq;
        if (uw ? (level > 15) : (level > 20)) {
            return 51840 * mult * 100 * 1000;
        } else {
            let time = [
                900, 1895, 3960, 8460, 18000, 28800, 41100, 66420,
                144000, 313200, 691200, 1152000, 1728000, 2221200,
                2880000, 3801600, 4147200, 4492800, 4838400, 5184000
            ][level - 1];

            let step = 1;
            if (time > 3600) {
                step = 100;
            }

            return ceilTo(time * mult, step) * 1000;
        }
    }

    $('#priceat-attribute').on('change input', function () {
        if (validate($(this))) {
            const value = getClampedValue(this, 1, Infinity);
            const cost = Calculations.goldAttributeCost(value - 1);

            $('#priceat-price').val(cost >= 10 ? formatAsSpacedNumber(cost, ' ') : roundShort(cost));
        }
    });

    function getClampedValue (selector, min, max) {
        return _clamp(Number($(selector).val()), min, max);
    }

    $('#misc-level, #misc-gate, #misc-torture').on('change input', function () {
        if (validate($('#misc-level'), $('#misc-gate'), $('#misc-torture'))) {
            const souls = Calculations.souls(
                getClampedValue('#misc-level', 1, 800),
                getClampedValue('#misc-gate', 0, 15),
                getClampedValue('#misc-torture', 0, 15)
            );
 
            $('#misc-souls').val(formatValue(souls));
        }
    });

    $('#pricebetween-from, #pricebetween-to').on('change input', function () {
        if (validate($('#pricebetween-from'), $('#pricebetween-to'))) {
            const attStart = getClampedValue('#pricebetween-from', 1, Infinity);
            const attEnd = getClampedValue('#pricebetween-to', attStart, Infinity);

            const cost = Calculations.goldAttributeTotalCost(attEnd - 1) - Calculations.goldAttributeTotalCost(attStart - 1);

            $('#pricebetween-price').val(cost >= 10 ? formatAsSpacedNumber(cost, ' ') : roundShort(cost));
        }
    });

    $('#xp-level, #xp-hydra, #xp-academy').on('change input', function () {
        if (validate($('#xp-level'), $('#xp-hydra'), $('#xp-academy'))) {
            const level = getClampedValue('#xp-level', 1, 799);
            const hydra = getClampedValue('#xp-hydra', 0, 20);
            const academy = getClampedValue('#xp-academy', 1, 20);

            const xp = Calculations.experienceNextLevel(level);
            const daily = Calculations.experienceSecretMission(level, hydra);
            const arena = Calculations.experienceArena(level);

            const [hourly, capacity, time] = getAcademyValues(level, academy);

            const wheel2 = Calculations.experienceWheelBooks(level); 
            const wheel1 = Calculations.experienceWheelBook(level);

            const calendar1 = Calculations.experienceCalendar(level, 0);
            const calendar2 = Calculations.experienceCalendar(level, 1);
            const calendar3 = Calculations.experienceCalendar(level, 2);
      
            const habitat = Calculations.experiencePetHabitat(level);
            const twister = Calculations.experienceTwisterEnemy(level);

            $('#xp-time').val(formatFancyTime(time));
            $('#xp-next').val(formatAsSpacedNumber(xp, ' '));
            $('#xp-arena').val(formatAsSpacedNumber(arena, ' '));
            $('#xp-daily').val(formatAsSpacedNumber(daily, ' '));
            $('#xp-hourly').val(formatAsSpacedNumber(hourly, ' '));
            $('#xp-capacity').val(formatAsSpacedNumber(capacity, ' '));

            $('#xp-wheel1').val(formatAsSpacedNumber(wheel1, ' '));
            $('#xp-wheel2').val(formatAsSpacedNumber(wheel2, ' '));

            $('#xp-calendar1').val(formatAsSpacedNumber(calendar1, ' '));
            $('#xp-calendar2').val(formatAsSpacedNumber(calendar2, ' '));
            $('#xp-calendar3').val(formatAsSpacedNumber(calendar3, ' '));

            $('#xp-habitat').val(formatAsSpacedNumber(habitat, ' '));
            $('#xp-twister').val(formatAsSpacedNumber(twister, ' '));
            $('#xp-dungeon').val(formatAsSpacedNumber(calendar3, ' '));
        }
    });

    const questUpdate = function () {
        if (validate($('#quest-level'), $('#quest-xp'), $('#quest-gold'), $('#quest-tower'), $('#quest-book'), $('#quest-rxp'), $('#quest-rgold'))) {
            const level = getClampedValue('#quest-level', 1, 800);
            const gxp = getClampedValue('#quest-xp', 0, 200);
            const ggold = getClampedValue('#quest-gold', 0, 200);
            const book = getClampedValue('#quest-book', 0, 100);
            const tower = getClampedValue('#quest-tower', 0, 100);
            const rxp = getClampedValue('#quest-rxp', 0, 10);
            const rgold = getClampedValue('#quest-rgold', 0, 50);
            const exp = $('#quest-exp').dropdown('get value') === '1' ? 1.1 : 1;
            const egold = $('#quest-egold').dropdown('get value') === '1' ? 1.1 : 1;

            const xpmin = exp * Calculations.experienceQuestMin(level, book, gxp, rxp);
            const xpmax = exp * Calculations.experienceQuestMax(level, book, gxp, rxp);

            const goldmin = egold * Calculations.goldQuestMin(level, tower, ggold, rgold);
            const goldmax = egold * Calculations.goldQuestMax(level, tower, ggold, rgold);

            $('#quest-goldmin').val(formatValue(goldmin));
            $('#quest-goldmax').val(formatValue(goldmax));
            $('#quest-xpmin').val(formatAsSpacedNumber(xpmin, ' '));
            $('#quest-xpmax').val(formatAsSpacedNumber(xpmax, ' '));
        }
    }

    $('#quest-level, #quest-xp, #quest-gold, #quest-tower, #quest-book, #quest-rxp, #quest-rgold').on('change input', questUpdate);
    $('#quest-exp, #quest-gold').dropdown().dropdown('setting', 'onChange', questUpdate)
                
    const expeditionUpdate = function () {
        if (validate($('#expedition-level'), $('#expedition-group-xp'), $('#expedition-group-gold'), $('#expedition-tower'), $('#expedition-book'), $('#expedition-rxp'), 
            $('#expedition-rgold'), $('#expedition-stars'))) {
            const level = getClampedValue('#expedition-level', 1, 800);
            const gxp = getClampedValue('#expedition-group-xp', 0, 200);
            const ggold = getClampedValue('#expedition-group-gold', 0, 200);
            const book = getClampedValue('#expedition-book', 0, 100);
            const tower = getClampedValue('#expedition-tower', 0, 100);
            const rxp = getClampedValue('#expedition-rxp', 0, 10);
            const rgold = getClampedValue('#expedition-rgold', 0, 50);
            const stars = getClampedValue('#expedition-stars', 0, 3);
            const mount = _clamp(Number.parseInt($('#expedition-mount').dropdown('get value')), 0, 4);
            const xpscroll = $('#expedition-enchantment_exp').dropdown('get value') === '1';
            const goldscroll = $('#expedition-enchantment_gold').dropdown('get value') === '1';

            const xp = Calculations.experienceExpedition(level, book, gxp, rxp, xpscroll, stars, mount);
            const gold = Calculations.goldExpedition(level, tower, ggold, rgold, goldscroll, mount);
            const chestGold = gold / 5; 
            const midGold = gold / 10;

            $('#expedition-gold').val(formatValue(gold));
            $('#expedition-gold_chest').val(formatValue(chestGold));
            $('#expedition-gold_mid').val(formatValue(midGold));
            $('#expedition-xp').val(formatAsSpacedNumber(xp, ' '));
        }
    }

    $('#expedition-level, #expedition-group-xp, #expedition-group-gold, #expedition-tower, #expedition-book, #expedition-rxp, #expedition-rgold, #expedition-stars').on('change input', expeditionUpdate) 
    $('#expedition-enchantment_exp, #expedition-enchantment_gold, #expedition-mount').dropdown().dropdown('setting', 'onChange', expeditionUpdate)

    $('#gold-level, #gold-guild, #gold-tower, #gold-mine, #gold-pit, #gold-runes').on('change input', function () {
        if (validate($('#gold-level'), $('#gold-guild'), $('#gold-tower'), $('#gold-mine'), $('#gold-runes'), $('#gold-pit'))) {
            const level = getClampedValue('#gold-level', 1, 800);
            const guild = getClampedValue('#gold-guild', 0, 200);
            const tower = getClampedValue('#gold-tower', 0, 100);
            const mine = getClampedValue('#gold-mine', 1, 14);
            const runes = getClampedValue('#gold-runes', 0, 5);
            const pit = getClampedValue('#gold-pit', 1, 100);

            const guard = Calculations.goldGuardDuty(level, tower, guild);
            const scroll = Calculations.goldWitchScroll(level);

            const [capacity, hourly, time] = getGoldPitValues(level, pit);

            const gem1 = Calculations.goldGem(level, mine, 0);
            const gem2 = Calculations.goldGem(level, mine, 1);
            const gem3 = Calculations.goldGem(level, mine, 2);

            const pot10 = Calculations.goldPotionCost(level, runes, 0);
            const pot15 = Calculations.goldPotionCost(level, runes, 1);
            const pot25 = Calculations.goldPotionCost(level, runes, 2);

            const pothp = Calculations.goldLifePotionCost(level, runes);
            const pothp_gold = Calculations.goldLifePotionShroomlessCost(level, runes);

            const reroll = Calculations.goldFortressReroll(level);
            const potwitch = Calculations.goldWitchPotion(level);

            const hourglass1 = Calculations.goldHourglassCost(level, runes); 
            const hourglass10 = Calculations.goldHourglassPackCost(level, runes);

            const dice1 = Calculations.goldDice(level, 0);
            const dice2 = Calculations.goldDice(level, 1);
            const dice3 = Calculations.goldDice(level, 2);

            const goldbar1 = Calculations.goldCalendarBar(level);
            const goldbar3 = Calculations.goldCalendarBars(level);

            const towerboss = Calculations.goldTowerEnemy(level);
            const twisterboss = Calculations.goldTwisterEnemy(level);
            const arenagold = Calculations.goldArena(level);
            const reward = Calculations.goldEnvironmentalReward(level);

            $('#gold-bar').val(formatValue(goldbar1));
            $('#gold-bar3').val(formatValue(goldbar3));
            $('#gold-towerboss').val(formatValue(towerboss));
            $('#gold-twisterboss').val(formatValue(twisterboss));

            $('#gold-pot10').val(formatValue(pot10));
            $('#gold-pot15').val(formatValue(pot15));
            $('#gold-pot25').val(formatValue(pot25));
            $('#gold-pothp').val(formatValue(pothp));
            $('#gold-pothp-gold').val(formatValue(pothp_gold));

            $('#gold-arena').val(formatValue(arenagold));

            $('#gold-scroll').val(formatValue(scroll));
            $('#gold-witchpot').val(formatValue(potwitch));

            $('#gold-hourglass1').val(formatValue(hourglass1));
            $('#gold-hourglass10').val(formatValue(hourglass10));

            $('#gold-guard').val(formatValue(guard));
            $('#gold-reward').val(formatValue(reward));
            $('#gold-reroll').val(formatValue(reroll));

            $('#gold-dice').val(formatValue(dice1));
            $('#gold-dice2').val(formatValue(dice2));
            $('#gold-dice3').val(formatValue(dice3));

            $('#gold-gem').val(formatValue(gem1));
            $('#gold-gem2').val(formatValue(gem2));
            $('#gold-gem3').val(formatValue(gem3));

            $('#gold-hourly').val(formatValue(hourly));
            $('#gold-time').val(formatFancyTime(time));
            $('#gold-capacity').val(formatAsSpacedNumber(capacity, ' '));
        }
    });

    (function () {
        var text = '';

        for (var i = 0; i < 3155; i++) {
            var cost = Calculations.goldAttributeCost(i);

            if (i < 632) {
                var curve = Calculations.gold(i + 1);

                var num = Math.trunc(curve / 10);
                num = num * 12 / 100;
                var griff = Math.min(10E6, num);

                text += `<tr>
                    <td>${ i + 1 }</td>
                    <td>${ cost >= 999 ? formatAsSpacedNumber(cost, ' ') : roundShort(cost) }</td>
                    <td>${ curve / 100 >= 999 ? formatAsSpacedNumber(curve / 100, ' ') : roundShort(curve / 100) }</td>
                    <td>${ griff >= 999 ? formatAsSpacedNumber(griff, ' ') : roundShort(griff) }</td>
                    <td>${ num / 3 >= 999 ? formatAsSpacedNumber(num / 3, ' ') :roundShort(num / 3) }</td>
                </tr>`;
            } else {
                text += `<tr>
                    <td>${ i + 1 }</td>
                    <td>${ cost >= 999 ? formatAsSpacedNumber(cost, ' ') : roundShort(cost) }</td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>`;
            }
        }

        text += `<tr>
            <td>3156+</td>
            <td>${ formatAsSpacedNumber(10e6, ' ') }</td>
            <td></td>
            <td></td>
            <td></td>
        </tr>`;

        $('#data-gold-table tbody').html(text);
    })();

    function copyGrid (headers, values, transformer) {
        let thead = `<tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>`;
        let tbody = values.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join('')}</tr>`).join('');
        if (transformer) {
            tbody = transformer(tbody);
        }
    
        const element = document.createElement('table');
        element.innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`;
        document.body.appendChild(element);
    
        copyNode(element);
    
        document.body.removeChild(element);
    }

    $('#copy-table').click(function () {
        copyGrid(
            $('#data-gold-table th').toArray().map(th => th.innerText),
            $('#data-gold-table tbody tr').toArray().map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText)),
            text => text.replaceAll(' ', '')
        )
    });

    $('#copy-table-col').click(function () {
        copyGrid(
            $('#data-gold-table th').toArray().map(th => th.innerText),
            $('#data-gold-table tbody tr').toArray().map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText)),
            text => text.replaceAll(' ', '').replaceAll('.', ',')
        )
    })
})
