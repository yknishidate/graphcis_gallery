import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

(async () => {
  try {
    const HOST = 'localhost';
    const PORT = 4322; // package.jsonで指定したポート番号

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // ウィンドウサイズを設定
    await page.setViewport({ width: 800, height: 600 });

    // プロジェクトディレクトリのパス
    const projectsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'projects');

    // プロジェクトファイルを取得
    const projectFiles = fs.readdirSync(projectsDir)
      .filter(file => 
        file.endsWith('.js') && file !== 'webgpu-utils.js'
      )
      .map(file => path.basename(file, '.js'));

    // プロジェクトの配列を動的に生成
    const projects = projectFiles.map(project => ({
      url: `http://${HOST}:${PORT}/projects/${project}`, 
      outputFile: `public/images/${project}-thumbnail.png`
    }));

    for (const project of projects) {
      try {
        // ページにアクセス（タイムアウトを追加）
        await page.goto(project.url, { 
          waitUntil: 'networkidle0',
          timeout: 10000 // 10秒でタイムアウト
        });

        // キャンバスを取得
        const canvas = await page.$('canvas');
        
        if (canvas) {
          // スクリーンショットを撮影
          await canvas.screenshot({ path: project.outputFile });
          console.log(`Screenshot saved: ${project.outputFile}`);
        } else {
          console.error(`Canvas not found for ${project.url}`);
        }
      } catch (projectError) {
        console.error(`Error processing project ${project.url}:`, projectError.message);
      }
    }

    await browser.close();
  } catch (error) {
    console.error('Error taking screenshots:', error);
    process.exit(1);
  }
})();
