const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const TMP_DIR = path.join(__dirname, 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

// ✅ MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_compiler';
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

// ✅ Submission model
const submissionSchema = new mongoose.Schema({
  fileId: String,
  language: String,
  code: String,
  stdin: String,
  output: String,
  error: String,
  createdAt: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', submissionSchema);

// ✅ File model for stored code files
const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  language: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

fileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

fileSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

const FileDoc = mongoose.model('File', fileSchema);

// Ensure filename ends with extension matching language
function ensureNameMatchesLanguage(name, language) {
  const map = { python: '.py', c: '.c', cpp: '.cpp', java: '.java' };
  const ext = map[language] || '';
  const base = typeof name === 'string' ? name.replace(/\.[^./\\]+$/, '') : 'Untitled';
  return base + ext;
}

// ✅ Run command safely with Windows shell
function runCommand(command, onComplete) {
  exec(command, { shell: "cmd.exe", timeout: 5000 }, (error, stdout, stderr) => {
    onComplete({ stdout, stderr, error });
  });
}

// ✅ Verify compiler availability
function verifyCompiler(command, args, callback) {
  exec(`${command} ${args}`, { shell: "cmd.exe" }, (err, stdout, stderr) => {
    if (err) {
      callback(false, stderr || err.message);
    } else {
      callback(true, stdout || stderr);
    }
  });
}

app.post('/run', (req, res) => {
  const { code, language, input } = req.body;
  const fileId = uuidv4();
  let filename;
  const stdin = typeof input === 'string' ? input : '';
  const inputFile = path.join(TMP_DIR, fileId + '.in');

  try {
    fs.writeFileSync(inputFile, stdin);

    const finalize = async ({ stdout, stderr, error: execError }) => {
      try {
        await Submission.create({
          fileId,
          language,
          code,
          stdin,
          output: stdout || '',
          error: stderr || (execError ? execError.message : '')
        });
      } catch (e) {
        console.error('Failed to save submission:', e.message);
      }
      if (execError) return res.json({ output: stdout, error: stderr || execError.message });
      return res.json({ output: stdout, error: stderr });
    };

    if (language === 'python') {
      // Try python3 first
      verifyCompiler("python3", "--version", (ok) => {
        if (ok) {
          filename = path.join(TMP_DIR, fileId + ".py");
          fs.writeFileSync(filename, code);
          return runCommand(`python3 "${filename}" < "${inputFile}"`, finalize);
        }
        // Fallback to python
        verifyCompiler("python", "--version", (ok2) => {
          if (ok2) {
            filename = path.join(TMP_DIR, fileId + ".py");
            fs.writeFileSync(filename, code);
            return runCommand(`python "${filename}" < "${inputFile}"`, finalize);
          }
          return finalize({ stdout: '', stderr: 'Python not installed locally. Please install from python.org.', error: new Error('Python missing') });
        });
      });

    } else if (language === 'c') {
      verifyCompiler("gcc", "--version", (ok, msg) => {
        if (!ok) return finalize({ stdout: '', stderr: "GCC check failed: " + msg, error: new Error('gcc missing') });

        filename = path.join(TMP_DIR, fileId + ".c");
        fs.writeFileSync(filename, code);
        const out = path.join(TMP_DIR, fileId + ".exe");

        // Step 1: Compile
        exec(`gcc "${filename}" -o "${out}"`, { shell: "cmd.exe" }, (err, stdout, stderr) => {
          if (err) return finalize({ stdout: '', stderr: stderr || err.message, error: err });

          // Step 2: Run
          return runCommand(`"${out}" < "${inputFile}"`, finalize);
        });
      });

    } else if (language === 'cpp') {
      verifyCompiler("g++", "--version", (ok, msg) => {
        if (!ok) return finalize({ stdout: '', stderr: "G++ check failed: " + msg, error: new Error('g++ missing') });

        filename = path.join(TMP_DIR, fileId + ".cpp");
        fs.writeFileSync(filename, code);
        const out = path.join(TMP_DIR, fileId + ".exe");

        // Step 1: Compile
        exec(`g++ "${filename}" -o "${out}"`, { shell: "cmd.exe" }, (err, stdout, stderr) => {
          if (err) return finalize({ stdout: '', stderr: stderr || err.message, error: err });

          // Step 2: Run
          return runCommand(`"${out}" < "${inputFile}"`, finalize);
        });
      });

    } else if (language === 'java') {
      verifyCompiler("javac", "-version", (ok, msg) => {
        if (!ok) return finalize({ stdout: '', stderr: "Java JDK check failed: " + msg, error: new Error('javac missing') });

        filename = path.join(TMP_DIR, "Main.java");
        fs.writeFileSync(filename, code);

        // Step 1: Compile
        exec(`javac "${filename}"`, { shell: "cmd.exe" }, (err, stdout, stderr) => {
          if (err) return finalize({ stdout: '', stderr: stderr || err.message, error: err });

          // Step 2: Run
          return runCommand(`java -cp "${TMP_DIR}" Main < "${inputFile}"`, finalize);
        });
      });

    } else {
      return finalize({ stdout: '', stderr: 'Unsupported language', error: new Error('unsupported') });
    }
  } catch (err) {
    return res.json({ error: err.message });
  }
});

// ===== File Manager Routes =====
// Create a new file
app.post('/files', async (req, res) => {
  try {
    const { name, language, content } = req.body;
    if (!name || !language || typeof content !== 'string') {
      return res.status(400).json({ error: 'Missing required fields: name, language, content' });
    }
    const normalizedName = ensureNameMatchesLanguage(name, language);
    const doc = await FileDoc.create({ name: normalizedName, language, content });
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// List files (lightweight)
app.get('/files', async (req, res) => {
  try {
    const docs = await FileDoc.find({}, { name: 1, language: 1, updatedAt: 1 }).sort({ updatedAt: -1 });
    return res.json(docs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get one file by id
app.get('/files/:id', async (req, res) => {
  try {
    const doc = await FileDoc.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'File not found' });
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update file (rename/content/language)
app.put('/files/:id', async (req, res) => {
  try {
    const { name, language, content } = req.body;
    const updates = {};
    if (typeof language === 'string') updates.language = language;
    if (typeof content === 'string') updates.content = content;
    if (typeof name === 'string' || typeof language === 'string') {
      const current = await FileDoc.findById(req.params.id);
      if (!current) return res.status(404).json({ error: 'File not found' });
      const nextLang = typeof language === 'string' ? language : current.language;
      const nextName = typeof name === 'string' ? name : current.name;
      updates.name = ensureNameMatchesLanguage(nextName, nextLang);
      updates.language = nextLang;
    }
    const doc = await FileDoc.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'File not found' });
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete file
app.delete('/files/:id', async (req, res) => {
  try {
    const doc = await FileDoc.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'File not found' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
