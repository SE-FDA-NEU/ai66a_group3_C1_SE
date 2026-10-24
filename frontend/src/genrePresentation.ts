const descriptions: Record<number, [string, string]> = {
  28: ["↗", "High stakes, daring stunts and a rush of adrenaline."],
  12: ["◈", "New places, bold journeys and the thrill of discovery."],
  16: ["✎", "Imaginative worlds brought to life, one frame at a time."],
  35: ["☺", "Quick wit, unexpected turns and a good laugh."],
  80: ["◎", "Heists, investigations and the people on either side."],
  99: ["◉", "Real people and stories worth a closer look."],
  18: ["❖", "Human stories, difficult choices and lasting emotions."],
  10751: ["♡", "Shared adventures for a movie night together."],
  14: ["✧", "Magic, mythical worlds and the impossible made real."],
  36: ["⌛", "People and moments that shaped the past."],
  27: ["☾", "Dark corners, creeping tension and unexpected scares."],
  10402: ["♫", "Performances and stories with music at their heart."],
  9648: ["⌕", "Hidden clues, puzzling motives and one more question."],
  10749: ["♥", "Connections, missed chances and falling in love."],
  878: ["✺", "Distant worlds, future possibilities and big what-ifs."],
  10770: ["▣", "Stories made for the small screen."],
  53: ["ϟ", "Rising tension and stories that keep you guessing."],
  10752: ["⚑", "Conflict, courage and the human cost of war."],
  37: ["⌁", "Frontier towns, wide horizons and uneasy stand-offs."],
};

export function genrePresentation(id: number, name: string) {
  // Metadata is explanatory copy only. Available/selected genres still come
  // exclusively from the API, including unknown future or synthetic IDs.
  const [symbol, description] = descriptions[id] ?? ["✦", `Discover more stories in ${name.toLocaleLowerCase()}.`];
  return { symbol, description };
}
