import axios from "axios";
import * as cheerio from "cheerio";
async function run() {
  const r = await axios.get("https://t.me/korzinkauz/25823?embed=1&mode=tme");
  console.log("length:", r.data.length);
  const $ = cheerio.load(r.data);
  const style = $(".tgme_widget_message_photo_wrap").attr("style");
  console.log("style:", style);
  
  if (!style) {
    console.log("Video possibly?", $(".tgme_widget_message_video_player").length);
    console.log("Background image:", $(".tgme_widget_message_photo_wrap").length);
  }
}
run();
