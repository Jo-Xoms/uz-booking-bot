import express from 'express';
import fs from 'fs';
import cors from 'cors';
import { spawn } from 'child_process';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/save-passengers', (req, res) => {
  const data = req.body;

  try {
    fs.writeFileSync('./src/scripts/passengers.json', JSON.stringify(data, null, 2), 'utf-8');
    res.status(200).json({ message: 'Дані збережено у passengers.json' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка при збереженні даних' });
  }
});

app.post('/run-uz', (req, res) => {
  try {
    fs.writeFileSync('./src/scripts/passengers.json', JSON.stringify(req.body, null, 2), 'utf-8');

    const child = spawn('node', ['./src/scripts/uz.js'], { cwd: process.cwd() });

    child.stdout.on('data', (data) => {
      console.log(`✅ STDOUT: ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`⚠️ STDERR: ${data}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        res.json({ message: '🚂 Скрипт завершився успішно' });
      } else {
        res.status(500).json({ error: `Скрипт завершився з кодом ${code}` });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не вдалося запустити скрипт' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер працює на http://localhost:${PORT}`);
});
