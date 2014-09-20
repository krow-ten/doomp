require 'sinatra'
require "sinatra/reloader"
require 'mongo'
require 'cgi'

def mongo
  begin
    uri  = URI.parse(ENV['MONGOHQ_URL'])
    conn = Mongo::Connection.from_uri(ENV['MONGOHQ_URL'])
    conn.db(uri.path.gsub(/^\//, ''))
  rescue
    Mongo::Connection.new.db('doomp')
  end
end

def store
  mongo.collection("store")
end


get '/' do
  redirect "/#{('a'..'z').to_a.shuffle.first(6).join}"
end

get '/:name' do
  @doomp = store.find_one( name: params[:name] ) || {'content' => ''}
  protected! @doomp
  erb :default
end

get "/:name/raw" do
  doomp = store.find_one( name: params[:name] ) || {'content' => ''}
  protected! doomp
  doomp['content']
end


post '/:name' do
  doomp = store.find_one( name: params[:name] )
  protected! doomp
  store.update(
    { name:  params[:name] },
    { '$set' => { name: params[:name], content: CGI.escapeHTML(params[:content]) }},
    { upsert: true}
  )
  "OK"
end

get "/:name/protect" do
  store.update(
    { name:  params[:name] },
    { '$set' => { protected: true }}
  )
  redirect "/#{params[:name]}"
end



helpers do
  def protected! doomp
    return if doomp && !doomp['protected'] || authorized?
    headers['WWW-Authenticate'] = 'Basic realm="Restricted Area"'
    halt 401, "Not authorized\n"
  end

  def authorized?
    @auth ||=  Rack::Auth::Basic::Request.new(request.env)
    @auth.provided? and @auth.basic? and @auth.credentials and @auth.credentials == ['', ENV['PASSWORD']]
  end
end
