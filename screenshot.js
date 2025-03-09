import puppeteer from 'puppeteer';

(async () => {
  try {
    const HOST = 'localhost';
    const PORT = 4322; // package.jsonで指定したポート番号

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // ウィンドウサイズを設定
    await page.setViewport({ width: 800, height: 600 });

    // プロジェクト
    const projects = [
      { 
        url: `http://${HOST}:${PORT}/projects/gradient`, 
        outputFile: 'public/images/gradient-thumbnail.png' 
      },
      { 
        url: `http://${HOST}:${PORT}/projects/triangle`, 
        outputFile: 'public/images/triangle-thumbnail.png' 
      }
    ];

    for (const project of projects) {
      try {
        // ページにアクセス（タイムアウトを追加）
        await page.goto(project.url, { 
          waitUntil: 'networkidle0',
          timeout: 5000 // 5秒でタイムアウト
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
