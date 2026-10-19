from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
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
        await self.send_json({'type': 'connected'})

    async def disconnect(self, close_code):
        group_name = getattr(self, 'group_name', None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def chat_message(self, event):
        await self.send_json({'type': 'message', 'message': event['payload']})

    @database_sync_to_async
    def user_is_active(self, user_id):
        return get_user_model().objects.filter(pk=user_id, is_active=True).exists()
