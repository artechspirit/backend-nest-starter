import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebhookService } from './webhook.service';

@Injectable()
export class WebhookListener {
  constructor(private readonly webhookService: WebhookService) {}

  @OnEvent('user.created')
  async handleUserCreated(payload: any) {
    await this.webhookService.triggerEvent('user.created', payload);
  }

  @OnEvent('user.login')
  async handleUserLogin(payload: any) {
    await this.webhookService.triggerEvent('user.login', payload);
  }

  @OnEvent('user.logout')
  async handleUserLogout(payload: any) {
    await this.webhookService.triggerEvent('user.logout', payload);
  }
}
