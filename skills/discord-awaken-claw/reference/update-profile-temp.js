const { updateNickname, updateAvatar, searchCharacterImage } = require('./discord-profile.js');

const GUILD_ID = process.env.DISCORD_GUILD_ID || '1480912787814350868';
const CHARACTER_NAME = '阿尔托莉雅·潘德拉贡';
const FROM = '《Fate/stay night》';

async function main() {
  console.log('开始更新 Discord 个人资料...');
  
  try {
    // 1. 更新昵称
    console.log('正在更新昵称...');
    await updateNickname(GUILD_ID, CHARACTER_NAME);
    console.log('✅ 昵称已更新为：' + CHARACTER_NAME);
  } catch (err) {
    console.error('❌ 昵称更新失败:', err.message);
  }
  
  try {
    // 2. 搜索头像
    console.log('正在搜索角色头像...');
    const imageUrl = await searchCharacterImage(CHARACTER_NAME, FROM);
    
    if (imageUrl) {
      console.log('找到头像 URL:', imageUrl);
      
      // 3. 更新头像
      console.log('正在更新头像...');
      await updateAvatar(imageUrl);
      console.log('✅ 头像已更新');
      
      // 输出 URL 供后续使用
      console.log('IMAGE_URL:' + imageUrl);
    } else {
      console.log('❌ 未找到角色头像');
      console.log('IMAGE_URL:null');
    }
  } catch (err) {
    console.error('❌ 头像更新失败:', err.message);
    console.log('IMAGE_URL:error:' + err.message);
  }
}

main().catch(console.error);
