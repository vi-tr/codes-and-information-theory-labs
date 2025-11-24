const amountEl = document.getElementById('msgAmount'); // поле ввода для количества сообщений
const trialsEl = document.getElementById('trials'); // поле ввода для количества испытаний
const runBtn = document.getElementById('run'); // кнопка запуска программы
const downloadSourceBtn = document.getElementById('download-source'); // кнопка скачивания исходного кода
const downloadOutputBtn = document.getElementById('download-output'); // кнопка скачивания вывода программы
const outputEl = document.getElementById('output'); // контейнер для вывода программы
const loadingEl = document.getElementById('code-throbber'); // индикатор загрузки/выполнения
const outputContentEl = document.getElementById('output-content'); // блок для текстового вывода программы

// элементы для вкладок и отображения содержимого файла
const fileTabsEl = document.getElementById('file-tabs');
const fileContentEl = document.getElementById('file-content');
const fileContentWrapperEl = document.getElementById('file-content-wrapper');
const fileDescriptionEl = document.getElementById('file-description');

// список доступных лабораторных и их описания
const FILES = {
    'lab1.ijs': 'Лабораторная работа №1: «Количество информации и неопределенность сообщения»',
    'lab2.ijs': 'Лабораторная работа №2: «Количество информации при неполной достоверности сообщений»',
    'lab3.ijs': 'Лабораторная работа №3: «Обобщенные характеристики сигналов и каналов»',
    'lab4.ijs': 'Лабораторная работа №4: «Систематический код»',
};

async function displayFileContent(filePath) {
    const label = document.querySelector(`label[for="msgAmount"]`);
    label.textContent = filePath === 'lab4.ijs' ? 'Количество информационных разрядов' : 'Количество возможных сообщений';
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const code = await response.text();
        fileContentEl.textContent = code;
        Prism.highlightElement(fileContentEl);

        // обновляем описание файла
        fileDescriptionEl.textContent = FILES[filePath] || '';

        // обновляем активную вкладку
        document.querySelectorAll('.file-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.file-tab[data-path="${filePath}"]`).classList.add('active');

    } catch (error) {
        console.error(`Ошибка при загрузки файла ${filePath}:`, error);
        fileContentEl.textContent = `Ошибка сети при загрузки файла ${filePath}. Попробуйте перезагрузить страницу?`;
    }
}

function createFileTabs() {
    fileTabsEl.innerHTML = ''; // очищаем существующие вкладки
    Object.keys(FILES).forEach(filePath => {
        const tab = document.createElement('button');
        tab.classList.add('file-tab');
        tab.dataset.path = filePath;
        tab.textContent = filePath.split('/').pop();
        tab.addEventListener('click', () => displayFileContent(filePath));
        fileTabsEl.appendChild(tab);
    });

    // отображаем первый файл по умолчанию либо файл из URL
    const urlTarget = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (urlTarget in FILES) {
        displayFileContent(urlTarget);
    } else if (Object.keys(FILES).length > 0) {
        displayFileContent(Object.keys(FILES)[0]);
    }
}

document.addEventListener('DOMContentLoaded', createFileTabs);

// Функция для вывода текста в блок результатов.
// Добавляет новую строку и автоматически прокручивает вывод вниз.
function out(text) {
    if (!outputContentEl) return;
    // избегаем добавления лишних пустых строк в самом начале вывода
    if (outputContentEl.textContent.trim() === "" && String(text).trim() === "") return;
    outputContentEl.textContent += String(text) + '\n';
    downloadOutputBtn.hidden = outputContentEl.textContent.trim() === '';
    outputEl.scrollTop = outputEl.scrollHeight;
}

Module['print'] = Module['print'] || function() {};
Module['printErr'] = Module['printErr'] || function() {};

// перенаправляем вывод emscripten в нашу функцию
Module.print = out;
Module.printErr = out;

function validate_int(value) {
    const strValue = String(value).trim();
    if (!/^\+?\d+$/.test(strValue)) {
        throw new TypeError("Введено неверное значение. Ожидается положительное целое число.");
    }
    const numberValue = Number(strValue);
    if (numberValue <= 0) {
        throw new TypeError("Число должно быть больше нуля.");
    }
    return numberValue;
}

runBtn.addEventListener('click', function() {
    outputContentEl.textContent = '';
    outputEl.scrollTop = outputEl.scrollHeight;
    loadingEl.hidden = false;
    downloadOutputBtn.hidden = true;

    // получаем исходный код и значения для переменных.
    const source = fileContentEl.textContent;
    const amount = amountEl.value;
    const trials = trialsEl.value;

    // используем setTimeout для асинхронного выполнения, чтобы UI успел обновиться
    // (показать индикатор загрузки и очистить вывод) до начала выполнения кода.
    setTimeout(() => {
        try {
            const activeTab = document.querySelector('.file-tab.active');
            const filename = activeTab ? activeTab.dataset.path : 'lab1.ijs';
            // валидируем и устанавливаем значения переменных 'amount' и 'trials' в J окружении
            if (filename === 'lab4.ijs') {
                jdo1(`data_length =: ${validate_int(amount)}`);
            } else {
                jdo1(`amount =: ${validate_int(amount)}`);
            }
            jdo1(`trials =: ${validate_int(trials)}`);

            // записываем исходный код программы во временный файл в виртуальной файловой системе
            FS.writeFile("/program.ijs", source, {
                encoding: "utf-8"
            });

            // выполняем код из временного файла.
            jdo1("(0!:0) <'program.ijs'");
        } catch (err) {
            outputContentEl.textContent = 'Ошибка: ' + (err && err.message ? err.message : String(err));
        } finally {
            loadingEl.hidden = true;
        }
    }, 50);
});

function downloadContent(content, filename, type) {
    const blob = new Blob([content], {
        type: type
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// обработчик для кнопки скачивания исходного кода
downloadSourceBtn.addEventListener('click', function() {
    const sourceCode = fileContentEl.textContent;
    const activeTab = document.querySelector('.file-tab.active');
    const filename = activeTab ? activeTab.dataset.path : 'program.ijs';
    downloadContent(sourceCode, filename, 'text/ijs');
});

// обработчик для кнопки скачивания вывода программы
downloadOutputBtn.addEventListener('click', function() {
    const outputContent = outputContentEl.textContent;
    const activeTab = document.querySelector('.file-tab.active');
    const filename = activeTab ? activeTab.dataset.path : 'program.ijs';
    downloadContent(outputContent, `${filename.slice(0, -4)}-output.txt`, 'text/plain');
});