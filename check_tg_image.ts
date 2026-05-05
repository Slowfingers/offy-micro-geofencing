import axios from "axios";
import * as cheerio from "cheerio";

async function run() {
  const r = await axios.get("https://t.me/s/korzinkauz");
  const $ = cheerio.load(r.data);
  const posts = $(".tgme_widget_message_wrap");
  console.log("posts length", posts.length);
  posts.slice(-5).each((i, post) => {
    const photo = $(post).find(".tgme_widget_message_photo_wrap").attr("style");
    console.log("photo style:", photo);
  });
}
run();
