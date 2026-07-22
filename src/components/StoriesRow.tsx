import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Story } from "@/constants/demo";
import { cn } from "@/lib/utils";

export function StoriesRow({ stories }: { stories: Story[] }) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-3 pb-1">
        {stories.map((story) => (
          <button
            key={story.id}
            type="button"
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <div
              className={cn(
                "rounded-full p-[2px]",
                story.viewed
                  ? "bg-muted"
                  : "bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500",
              )}
            >
              <Avatar className="size-14 border-2 border-background">
                <AvatarImage src={story.avatarUrl} alt={story.username} />
                <AvatarFallback>{story.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <span className="max-w-14 truncate text-[10px] text-muted-foreground">
              {story.username}
            </span>
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" className="hidden" />
    </ScrollArea>
  );
}
