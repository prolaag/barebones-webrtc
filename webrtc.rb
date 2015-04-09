require 'sinatra'
require 'json'

class WebRTCWebsite < Sinatra::Base
  before do
    # hash of arrays; key is channel, array contains queued messages
    @@signals ||= Hash.new{ |hash, key| hash[key] = [] }
  end

  # clients post to here for signaling
  post '/send/:channel' do |channel|
    payload = JSON.parse(request.body.read)
    @@signals[channel] << {msg: payload['msg'], source: request.ip} if payload['msg']

    @@signals[channel].size.to_s
  end

  # read messages from the given channel NOT sent by self
  get '/read/:channel' do |channel|
    message = nil

    @@signals[channel].each_with_index do |msg, idx|
      next if msg[:source] == request.ip

      message = msg[:msg]
      @@signals[channel].delete_at(idx)
      break
    end

    (message || {}).to_json
  end

  get '/mini_video' do
    erb :mini_video
  end

  get '/mini_chat' do
    erb :mini_chat
  end

  get '/file_transfer' do
    erb :file_transfer
  end

  get '/mini_sdp' do
    erb :mini_sdp
  end

  get '/*' do
    erb :index
  end
end
