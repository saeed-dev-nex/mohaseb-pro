from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import ChatPresence
from rest_framework_simplejwt.tokens import AccessToken


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        protocols = self.scope.get('subprotocols', [])
        token = protocols[1] if len(protocols) > 1 and protocols[0] == 'mohaseb-chat' else None
        if not token:
            await self.close(code=4401)
            return

        try:
            access_token = AccessToken(token)
            self.user_id = access_token['user_id']
            if not await self.user_is_active(self.user_id):
                await self.close(code=4401)
                return
        except Exception:
            await self.close(code=4401)
            return

        self.group_name = 'chat_room'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept(subprotocol='mohaseb-chat')
        await self.touch_presence(self.user_id)
        await self.channel_layer.group_send(self.group_name, {'type': 'chat.presence', 'user_id': self.user_id})
        await self.send_json({'type': 'connected'})

    async def disconnect(self, close_code):
        group_name = getattr(self, 'group_name', None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def chat_message(self, event):
        message = event['payload']
        if not message.get('recipient') or self.user_id in (message.get('sender'), message.get('recipient')):
            await self.send_json({'type': 'message', 'message': message})

    async def chat_presence(self, event):
        await self.send_json({'type': 'presence', 'user_id': event['user_id']})

    async def chat_deleted(self, event):
        await self.send_json({'type': 'deleted', 'message_id': event['message_id']})

    async def receive_json(self, content, **kwargs):
        if content.get('type') == 'heartbeat':
            await self.touch_presence(self.user_id)

    @database_sync_to_async
    def touch_presence(self, user_id):
        ChatPresence.objects.update_or_create(user_id=user_id, defaults={'last_seen': timezone.now()})

    @database_sync_to_async
    def user_is_active(self, user_id):
        return get_user_model().objects.filter(pk=user_id, is_active=True).exists()
