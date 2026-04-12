import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';

const config = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    numbersToExpressions: true,
    simplify: true,
    stringArrayThreshold: 1,
    splitStrings: true,
    splitStringsChunkLength: 5,
    identifierNamesGenerator: 'hexadecimal',
    domainLock: ['anim1tube.vercel.app'], // Domain lock applied
    selfDefending: true,
    debugProtection: true,
    debugProtectionInterval: 4000,
    disableConsoleOutput: true,
    stringArray: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayIndexShift: true,
    stringArrayEncoding: ['base64'],
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    transformObjectKeys: true,
    unicodeEscapeSequence: true
};

function protectExtension(sourceDir, distDir) {
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    const files = fs.readdirSync(sourceDir);

    for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const distPath = path.join(distDir, file);

        if (fs.statSync(sourcePath).isDirectory()) {
            protectExtension(sourcePath, distPath);
            continue;
        }

        if (file.endsWith('.js')) {
            console.log(`🔒 Obfuscating: ${sourcePath} -> ${distPath}`);
            const code = fs.readFileSync(sourcePath, 'utf8');
            try {
                const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, config).getObfuscatedCode();
                fs.writeFileSync(distPath, obfuscatedCode);
            } catch (err) {
                console.error(`❌ Failed to obfuscate ${file}:`, err);
            }
        } else {
            console.log(`📄 Copying: ${sourcePath} -> ${distPath}`);
            fs.copyFileSync(sourcePath, distPath);
        }
    }
}

async function main() {
    const cwd = process.cwd();
    console.log('--- 🛡️ Extension Protection Studio 🛡️ ---');
    console.log(`Current directory: ${cwd}`);

    const sources = ['extension_auto', 'extension_standard'];
    const distBase = 'dist_extensions';

    if (fs.existsSync(distBase)) {
        console.log(`🧹 Cleaning previous distribution...`);
        fs.rmSync(distBase, { recursive: true, force: true });
    }

    for (const src of sources) {
        const srcPath = path.join(cwd, src);
        const dstPath = path.join(cwd, distBase, src);
        
        if (fs.existsSync(srcPath)) {
            console.log(`\n📂 Processing: ${src}...`);
            protectExtension(srcPath, dstPath);
        } else {
            console.warn(`⚠️ Source directory not found: ${src}`);
        }
    }

    console.log('\n--- ✅ Protection complete! ---');
    console.log(`Output folder: ${path.join(cwd, distBase)}`);
}

main().catch(console.error);
