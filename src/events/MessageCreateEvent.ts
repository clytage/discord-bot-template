import { Message, User } from "discord.js";
import { BaseEvent } from "../structures/BaseEvent.js";
import { Event } from "../utils/decorators/Event.js";
import { createEmbed } from "../utils/functions/createEmbed.js";

@Event("messageCreate")
export class MessageCreateEvent extends BaseEvent {
    public execute(message: Message): void {
        if (message.author.bot || message.channel.isDMBased()) return;

        if (message.content.startsWith(this.client.config.prefix)) {
            this.client.commands.handle(message);
            return;
        }

        if (this.getUserFromMention(message.content)?.id === this.client.user!.id) {
            message
                .reply({
                    embeds: [
                        createEmbed(
                            "info",
                            `👋 **|** Hi ${message.author.toString()}, my prefix is **\`${
                                this.client.config.prefix
                            }\`**`
                        )
                    ]
                })
                .catch(error => this.client.logger.error("PROMISE_ERR:", error));
        }
    }

    private getUserFromMention(mention: string): User | undefined {
        const match = (/^<@!?(?<id>\d+)>$/).exec(mention);
        if (!match) return undefined;

        const id = match.groups!.id;
        return this.client.users.cache.get(id);
    }
}
