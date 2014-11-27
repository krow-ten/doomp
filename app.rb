require 'sinatra'
require "sinatra/reloader"
require 'mongo'
require 'cgi'
enable :sessions

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


post "/:name/protect" do
  store.update(
    { name:  params[:name] },
    { '$set' => { protected: true, password: CGI.escapeHTML(params['password']) }},
    { upsert: true }
  )
  "OK"
end  

get "/:name/login" do
  redirect "/#{params['name']}" if session[params['name']]
  erb :login
end

post "/:name/login" do
  name  = params['name'] 
  doomp = store.find_one( name: name)
  if params['password'] == doomp['password']
    session[name] = doomp['password']
    redirect "/#{name}" 
  end  
  redirect "/#{name}/login" 
end


helpers do
  def protected! doomp
    return if !doomp
    return if !doomp['protected'] 
    redirect "/#{doomp['name']}/login" unless authenticated?(doomp)
  end

  def authenticated? doomp
     session[doomp['name']] == doomp['password']
  end

end
